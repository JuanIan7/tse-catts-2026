import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { normalizePublicBriefing } from "@/lib/tse/briefing";
import { openAIResponseError } from "@/lib/tse/openai-error";
import { briefingNarration, type Difficulty } from "@/lib/tse/session-case";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const turnId = new URL(request.url).searchParams.get("turnId");
  if (!turnId) return NextResponse.json({ error: "Resposta de abertura inválida." }, { status: 400 });
  const { user } = await requireApprovedUser();
  const admin = createSupabaseAdminClient();
  const [{ data: session }, { data: turn }, { data: secret }] = await Promise.all([
    admin.from("training_sessions").select("user_id, difficulty, public_briefing").eq("id", sessionId).maybeSingle(),
    admin.from("training_transcripts").select("speaker, content, delivery_status").eq("id", turnId).eq("session_id", sessionId).maybeSingle(),
    admin.from("training_session_secrets").select("internal_case").eq("session_id", sessionId).maybeSingle(),
  ]);
  if (!session || session.user_id !== user.id) return NextResponse.json({ error: "Ocorrência indisponível." }, { status: 404 });
  if (!turn || turn.speaker !== "PERSONAGEM" || turn.delivery_status !== "PENDENTE") return NextResponse.json({ error: "Abertura de voz indisponível." }, { status: 409 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Integração de voz indisponível." }, { status: 503 });
  const briefing = normalizePublicBriefing(session.public_briefing, session.difficulty as Difficulty);
  const profile = (secret?.internal_case as { perfil_tipo?: string } | null)?.perfil_tipo;
  const characterDirection = profile === "AGRESSIVO"
    ? "Na segunda parte, passe para uma voz adulta irritada e defensiva."
    : profile === "PSICOTICO"
      ? "Na segunda parte, passe para uma voz adulta assustada, hesitante e fragmentada."
      : "Na segunda parte, passe para uma voz adulta abatida e embargada.";
  const input = `${briefingNarration(briefing)}\n\n${turn.content}`;
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "marin", input, instructions: `Fale em português brasileiro. Leia a descrição de modo claro, operacional e sereno. Faça uma pausa breve antes de mudar para a voz do tentante. ${characterDirection} Não anuncie rótulos nem repita instruções.`, response_format: "mp3" }),
    });
  } catch {
    return NextResponse.json({ error: "Sem conexão com a voz de abertura. Tente novamente." }, { status: 503 });
  }
  if (!response.ok) return NextResponse.json({ error: await openAIResponseError(response, "gerar o áudio inicial") }, { status: 502 });
  return new NextResponse(await response.arrayBuffer(), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" } });
}
