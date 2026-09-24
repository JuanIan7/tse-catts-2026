import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordStudentTurn } from "@/lib/tse/conversation";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { user } = await requireApprovedUser();
  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin.from("profiles").select("voice_consent_at").eq("user_id", user.id).maybeSingle();
  if (!profile?.voice_consent_at) return NextResponse.json({ error: "Confirme o termo de voz antes de continuar." }, { status: 403 });
  const form = await request.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size === 0 || audio.size > 12_000_000) return NextResponse.json({ error: "Envie um áudio de até 12 MB." }, { status: 400 });
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Integração de voz indisponível." }, { status: 503 });
  const transcriptionForm = new FormData();
  transcriptionForm.set("file", audio, audio.name || "fala.webm");
  transcriptionForm.set("model", "gpt-4o-mini-transcribe");
  transcriptionForm.set("language", "pt");
  const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: transcriptionForm });
  if (!transcriptionResponse.ok) return NextResponse.json({ error: "Não foi possível transcrever esta fala." }, { status: 502 });
  const transcription = await transcriptionResponse.json() as { text?: string };
  const text = transcription.text?.trim();
  if (!text) return NextResponse.json({ error: "Não foi possível compreender a fala. Tente novamente ou use texto." }, { status: 422 });
  const turn = await recordStudentTurn({ userId: user.id, sessionId, content: text, source: "VOZ" });
  return NextResponse.json({ transcript: text, ...turn });
}
