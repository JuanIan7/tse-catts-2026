import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizePublicBriefing } from "@/lib/tse/briefing";
import { openAIResponseError } from "@/lib/tse/openai-error";
import { briefingNarration, type Difficulty } from "@/lib/tse/session-case";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { user } = await requireApprovedUser();
  const { data: session } = await createSupabaseAdminClient().from("training_sessions").select("user_id, difficulty, public_briefing").eq("id", sessionId).maybeSingle();
  if (!session || session.user_id !== user.id) return NextResponse.json({ error: "Ocorrência indisponível." }, { status: 404 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Narração indisponível." }, { status: 503 });
  const briefing = normalizePublicBriefing(session.public_briefing, session.difficulty as Difficulty);
  const narration = `${briefingNarration(briefing)} Aparência observável: ${briefing.aparencia_observavel}. Primeira leitura visual: ${briefing.observaveis_iniciais.join("; ")}.`;
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "marin", input: narration, instructions: "Narre em português brasileiro, com voz clara, objetiva e operacional, em ritmo moderado. Não dramatize.", response_format: "mp3" }),
    });
  } catch {
    return NextResponse.json({ error: "Sem conexão com o serviço de narração. Tente novamente." }, { status: 503 });
  }
  if (!response.ok) return NextResponse.json({ error: await openAIResponseError(response, "narrar a ocorrência") }, { status: 502 });
  return new NextResponse(await response.arrayBuffer(), { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, no-store" } });
}
