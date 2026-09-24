import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { openAIResponseError } from "@/lib/tse/openai-error";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const turnId = new URL(request.url).searchParams.get("turnId");
  if (!turnId) return NextResponse.json({ error: "Resposta de voz inválida." }, { status: 400 });
  const { user } = await requireApprovedUser();
  const admin = createSupabaseAdminClient();
  const { data: session } = await admin.from("training_sessions").select("user_id").eq("id", sessionId).maybeSingle();
  if (!session || session.user_id !== user.id) return NextResponse.json({ error: "Ocorrência indisponível." }, { status: 404 });
  const { data: turn } = await admin.from("training_transcripts").select("speaker, content, delivery_status").eq("id", turnId).eq("session_id", sessionId).maybeSingle();
  if (!turn || turn.speaker !== "PERSONAGEM" || !["PENDENTE", "OUVIDO"].includes(turn.delivery_status)) return NextResponse.json({ error: "Resposta de voz indisponível." }, { status: 409 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Integração de voz indisponível." }, { status: 503 });
  const { data: secret } = await admin.from("training_session_secrets").select("internal_case").eq("session_id", sessionId).maybeSingle();
  const profile = (secret?.internal_case as { perfil_tipo?: string } | null)?.perfil_tipo;
  const delivery = profile === "AGRESSIVO"
    ? "Fale em português brasileiro com raiva real, tom alto e impaciente, sem risada nem deboche."
    : profile === "PSICOTICO"
      ? "Fale em português brasileiro com medo, hesitação e ritmo fragmentado; nunca pareça subitamente calmo."
      : "Fale em português brasileiro com voz embargada, abatida e pausas de choro contido.";
  const instructions = `${delivery} Interprete apenas a fala do personagem, sem narrar ações nem acrescentar palavras.`;
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "marin", input: turn.content, instructions, response_format: "mp3" }),
    });
  } catch {
    return NextResponse.json({ error: "Sem conexão com a voz do tentante. Tente novamente." }, { status: 503 });
  }
  if (!response.ok) return NextResponse.json({ error: await openAIResponseError(response, "gerar a voz do tentante") }, { status: 502 });
  return new NextResponse(await response.arrayBuffer(), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
