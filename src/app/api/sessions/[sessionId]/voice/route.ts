import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordStudentTurn } from "@/lib/tse/conversation";
import { openAIResponseError } from "@/lib/tse/openai-error";

export const runtime = "nodejs";
const activeStatuses = new Set(["CRIADA", "EM_ANDAMENTO", "RECONEXAO"]);

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { user } = await requireApprovedUser();
  const admin = createSupabaseAdminClient();
  const [{ data: profile }, { data: session }] = await Promise.all([
    admin.from("profiles").select("voice_consent_at").eq("user_id", user.id).maybeSingle(),
    admin.from("training_sessions").select("user_id, status").eq("id", sessionId).maybeSingle(),
  ]);
  if (!session || session.user_id !== user.id) return NextResponse.json({ error: "Ocorrência indisponível." }, { status: 404 });
  if (!activeStatuses.has(session.status)) return NextResponse.json({ error: "Esta ocorrência já foi encerrada." }, { status: 409 });
  if (!profile?.voice_consent_at) return NextResponse.json({ error: "Confirme o termo de voz antes de continuar." }, { status: 403 });

  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0) return NextResponse.json({ error: "Nenhum áudio foi recebido. Grave novamente ou use o campo de texto." }, { status: 400 });
  if (!audio.type.startsWith("audio/")) return NextResponse.json({ error: "O navegador enviou um formato que não é de áudio. Atualize a página e tente novamente." }, { status: 415 });
  if (audio.size > 4_000_000) return NextResponse.json({ error: "A gravação ficou maior que o limite de envio. Faça uma fala de até 90 segundos e tente novamente." }, { status: 413 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Integração de voz indisponível." }, { status: 503 });

  const transcriptionForm = new FormData();
  transcriptionForm.set("file", audio, audio.name || "fala.webm");
  transcriptionForm.set("model", "gpt-4o-mini-transcribe");
  transcriptionForm.set("language", "pt");
  let transcriptionResponse: Response;
  try {
    transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: transcriptionForm,
    });
  } catch {
    return NextResponse.json({ error: "Sem conexão com o serviço de transcrição. Tente novamente." }, { status: 503 });
  }
  if (!transcriptionResponse.ok) {
    const requestId = transcriptionResponse.headers.get("x-request-id");
    const error = await openAIResponseError(transcriptionResponse, "transcrever a fala");
    console.error("Falha na transcrição de voz", { status: transcriptionResponse.status, requestId, mimeType: audio.type, size: audio.size });
    return NextResponse.json({ error }, { status: 502 });
  }

  const transcription = await transcriptionResponse.json() as { text?: string };
  const text = transcription.text?.trim();
  if (!text) return NextResponse.json({ error: "Não foi possível compreender a fala. Tente novamente ou use texto." }, { status: 422 });
  try {
    const turn = await recordStudentTurn({ userId: user.id, sessionId, content: text, source: "VOZ" });
    return NextResponse.json({ transcript: text, ...turn });
  } catch (cause) {
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "Não foi possível responder à fala." }, { status: 503 });
  }
}
