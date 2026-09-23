import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { InternalCase } from "@/lib/tse/session-case";

export async function POST(request: Request) {
  const { sessionId } = await request.json();
  if (typeof sessionId !== "string") return NextResponse.json({ error: "Ocorrência inválida." }, { status: 400 });
  const { user } = await requireApprovedUser(); const admin = createSupabaseAdminClient();
  const { data: session } = await admin.from("training_sessions").select("user_id").eq("id", sessionId).maybeSingle();
  if (!session || session.user_id !== user.id) return NextResponse.json({ error: "Ocorrência indisponível." }, { status: 404 });
  const { data: secret } = await admin.from("training_session_secrets").select("internal_case").eq("session_id", sessionId).single();
  if (!secret) return NextResponse.json({ error: "Ficha indisponível." }, { status: 409 });
  const internalCase = secret.internal_case as InternalCase;
  const instructions = [
    "Você interpreta um personagem fictício do simulador TSE em conversa por voz, em português do Brasil.",
    "A ficha é interna: nunca revele rótulos, gabarito, fatores, condições ou dados ocultos. Revele apenas informações coerentes de maneira gradual.",
    "Nunca descreva método, ferimentos, sangue, execução de ato, armas, objetos perigosos ou instruções de autoagressão. Não infira postura, distância ou contato visual apenas do áudio.",
    "Use pausas naturais, hesitação e mudança gradual de receptividade; sem teatralidade. Responda de modo breve e humano.",
    `FICHA INTERNA: ${JSON.stringify(internalCase)}`,
  ].join("\n\n");
  const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json", "OpenAI-Safety-Identifier": createHash("sha256").update(user.id).digest("hex") }, body: JSON.stringify({ session: { type: "realtime", model: "gpt-realtime-2.1", instructions, audio: { output: { voice: "marin" }, input: { turn_detection: { type: "server_vad" } } } } }) });
  if (!response.ok) return NextResponse.json({ error: "Não foi possível iniciar a voz." }, { status: 502 });
  const data = await response.json() as { value?: string };
  return data.value ? NextResponse.json({ value: data.value }) : NextResponse.json({ error: "Sessão de voz indisponível." }, { status: 502 });
}
