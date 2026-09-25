"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { finalizeManualTrainingSession, recordStudentTurn } from "@/lib/tse/conversation";
import { createSessionCase, difficultySchema, openingCharacterLine } from "@/lib/tse/session-case";

export async function createTrainingSession(formData: FormData) {
  const difficulty = difficultySchema.safeParse(String(formData.get("difficulty") ?? ""));
  if (!difficulty.success) throw new Error("Dificuldade inválida.");
  const { user } = await requireApprovedUser();
  const admin = createSupabaseAdminClient();
  const { data: recentSessions } = await admin.from("training_sessions").select("public_briefing").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3);
  const recentTitles = (recentSessions ?? []).flatMap((row) => {
    const briefing = row.public_briefing as { titulo?: unknown } | null;
    return typeof briefing?.titulo === "string" ? [briefing.titulo] : [];
  });
  const { internalCase, publicBriefing } = createSessionCase(difficulty.data, Math.random, recentTitles);
  const { data: session, error: sessionError } = await admin.from("training_sessions").insert({
    user_id: user.id,
    difficulty: difficulty.data,
    status: "CRIADA",
    public_briefing: publicBriefing,
    scenario_version: "tse-three-profiles-2026-09-24",
  }).select("id").single();
  if (sessionError || !session) throw new Error("Não foi possível preparar a ocorrência.");
  const { error: secretError } = await admin.from("training_session_secrets").insert({
    session_id: session.id,
    internal_case: internalCase,
    model_instructions: "TSE: ficha interna estável; revelação gradual; sem expor conteúdo oculto.",
    prompt_version: "tse-three-profiles-2026-09-24",
  });
  if (secretError) {
    await admin.from("training_sessions").delete().eq("id", session.id);
    throw new Error("Não foi possível proteger a ficha interna da ocorrência.");
  }
  const { error: openingError } = await admin.rpc("append_training_transcript", {
    p_session_id: session.id,
    p_speaker: "PERSONAGEM",
    p_content: openingCharacterLine(internalCase),
    p_source: "SISTEMA",
    p_delivery_status: "PENDENTE",
    p_event_metadata: { event: "ABERTURA" },
  });
  if (openingError) {
    await admin.from("training_sessions").delete().eq("id", session.id);
    throw new Error("Não foi possível iniciar a fala do tentante.");
  }
  redirect(`/app/sessions/${session.id}`);
}

export async function endTrainingSession(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const { user } = await requireApprovedUser();
  await finalizeManualTrainingSession({ userId: user.id, sessionId });
  revalidatePath("/app/sessions/" + sessionId);
  redirect("/app/sessions/" + sessionId);
}

export async function sendTrainingTurn(_previous: { error: string; sent: boolean; nonce: number }, formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const content = String(formData.get("content") ?? "");
  let shouldRefresh = false;
  try {
    const { user } = await requireApprovedUser();
    await recordStudentTurn({ userId: user.id, sessionId, content, source: "TEXTO" });
    shouldRefresh = true;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Não foi possível enviar a fala. Tente novamente.";
    if (!message.includes("tempo da ocorrência terminou")) return { error: message, sent: false, nonce: Date.now() };
    shouldRefresh = true;
  }
  if (shouldRefresh) {
    revalidatePath("/app/sessions/" + sessionId);
    redirect("/app/sessions/" + sessionId);
  }
  return { error: "", sent: false, nonce: Date.now() };
}
