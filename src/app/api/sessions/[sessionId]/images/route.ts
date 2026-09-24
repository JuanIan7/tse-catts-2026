import { NextResponse } from "next/server";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizePublicBriefing } from "@/lib/tse/briefing";
import { openAIErrorMessage } from "@/lib/tse/openai-error";
import { generateCharacterImage, generatePovImage } from "@/lib/tse/pov-image";
import type { Difficulty, InternalCase } from "@/lib/tse/session-case";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { user } = await requireApprovedUser();
  const admin = createSupabaseAdminClient();
  const { data: session } = await admin.from("training_sessions").select("user_id, difficulty, image_path, character_image_path, public_briefing").eq("id", sessionId).maybeSingle();
  if (!session || session.user_id !== user.id) return NextResponse.json({ error: "Ocorrência indisponível." }, { status: 404 });
  if (session.image_path && session.character_image_path) return NextResponse.json({ location: true, character: true, generated: false });
  const { data: secret } = await admin.from("training_session_secrets").select("internal_case").eq("session_id", sessionId).maybeSingle();
  if (!secret) return NextResponse.json({ error: "Ficha pedagógica indisponível." }, { status: 409 });
  const briefing = normalizePublicBriefing(session.public_briefing, session.difficulty as Difficulty);
  const internalCase = secret.internal_case as InternalCase;
  const jobs: Promise<{ field: "image_path" | "character_image_path"; path: string }>[] = [];
  if (!session.image_path) jobs.push((async () => {
    const path = `${sessionId}/location.webp`;
    const bytes = await generatePovImage(briefing);
    const { error } = await admin.storage.from("tse-session-images").upload(path, bytes, { contentType: "image/webp", upsert: true });
    if (error) throw error;
    return { field: "image_path" as const, path };
  })());
  if (!session.character_image_path) jobs.push((async () => {
    const path = `${sessionId}/character.webp`;
    const bytes = await generateCharacterImage(internalCase, briefing);
    const { error } = await admin.storage.from("tse-session-images").upload(path, bytes, { contentType: "image/webp", upsert: true });
    if (error) throw error;
    return { field: "character_image_path" as const, path };
  })());
  const results = await Promise.allSettled(jobs);
  const updates: Record<string, string> = {};
  for (const result of results) if (result.status === "fulfilled") updates[result.value.field] = result.value.path;
  if (Object.keys(updates).length) await admin.from("training_sessions").update(updates).eq("id", sessionId);
  const location = Boolean(session.image_path || updates.image_path);
  const character = Boolean(session.character_image_path || updates.character_image_path);
  if (!location && !character) {
    const rejected = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    return NextResponse.json({ error: openAIErrorMessage(rejected?.reason, "gerar as imagens da ocorrência") }, { status: 502 });
  }
  return NextResponse.json({ location, character, generated: true });
}
