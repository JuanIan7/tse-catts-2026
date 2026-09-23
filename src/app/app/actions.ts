"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { respondAsCharacter } from "@/lib/tse/character";
import { createSessionCase, difficultySchema, type InternalCase } from "@/lib/tse/session-case";

export async function createTrainingSession(formData: FormData) {
  const difficulty = difficultySchema.safeParse(String(formData.get("difficulty") ?? ""));
  if (!difficulty.success) throw new Error("Dificuldade inválida.");
  const { user } = await requireApprovedUser();
  const { internalCase, publicBriefing } = createSessionCase(difficulty.data);
  const admin = createSupabaseAdminClient();
  const { data: session, error: sessionError } = await admin.from("training_sessions").insert({ user_id: user.id, difficulty: difficulty.data, status: "CRIADA", public_briefing: publicBriefing }).select("id").single();
  if (sessionError || !session) throw new Error("Não foi possível preparar a ocorrência.");
  const { error: secretError } = await admin.from("training_session_secrets").insert({ session_id: session.id, internal_case: internalCase, model_instructions: "TSE v0.3: ficha interna estável; revelação gradual; sem expor conteúdo oculto.", prompt_version: "tse-v0.3-local-seed-1" });
  if (secretError) { await admin.from("training_sessions").delete().eq("id", session.id); throw new Error("Não foi possível proteger a ficha interna da ocorrência."); }
  redirect(`/app/sessions/${session.id}`);
}

export async function sendTrainingTurn(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  if (!sessionId || !content || content.length > 3000) throw new Error("Envie uma fala entre 1 e 3000 caracteres.");
  const { user } = await requireApprovedUser();
  const admin = createSupabaseAdminClient();
  const { data: session } = await admin.from("training_sessions").select("id, user_id, status").eq("id", sessionId).maybeSingle();
  if (!session || session.user_id !== user.id || !["CRIADA", "EM_ANDAMENTO"].includes(session.status)) throw new Error("Ocorrência indisponível.");
  const { data: secret } = await admin.from("training_session_secrets").select("internal_case").eq("session_id", sessionId).single();
  if (!secret) throw new Error("Ficha interna indisponível.");
  const { data: previous } = await admin.from("training_transcripts").select("speaker, content, sequence_number").eq("session_id", sessionId).order("sequence_number", { ascending: true }).limit(24);
  const transcript = (previous ?? []).map((turn) => ({ speaker: turn.speaker as "ALUNO" | "PERSONAGEM" | "NARRADOR" | "SISTEMA", content: turn.content }));
  const sequence = (previous?.at(-1)?.sequence_number ?? 0) + 1;
  const { error: studentError } = await admin.from("training_transcripts").insert({ session_id: sessionId, speaker: "ALUNO", content, sequence_number: sequence });
  if (studentError) throw new Error("Não foi possível registrar sua fala.");
  const character = await respondAsCharacter(secret.internal_case as InternalCase, [...transcript, { speaker: "ALUNO", content }]);
  const { error: characterError } = await admin.from("training_transcripts").insert({ session_id: sessionId, speaker: "PERSONAGEM", content: character.fala, sequence_number: sequence + 1 });
  if (characterError) throw new Error("Não foi possível registrar a resposta do personagem.");
  await admin.from("training_sessions").update({ status: "EM_ANDAMENTO", started_at: new Date().toISOString() }).eq("id", sessionId);
  revalidatePath(`/app/sessions/${sessionId}`);
}
