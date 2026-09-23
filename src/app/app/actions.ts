"use server";
import { redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSessionCase, difficultySchema } from "@/lib/tse/session-case";

export async function createTrainingSession(formData: FormData) {
  const difficulty = difficultySchema.safeParse(String(formData.get("difficulty") ?? ""));
  if (!difficulty.success) throw new Error("Dificuldade inválida.");

  const { user } = await requireApprovedUser();
  const { internalCase, publicBriefing } = createSessionCase(difficulty.data);
  const admin = createSupabaseAdminClient();
  const { data: session, error: sessionError } = await admin
    .from("training_sessions")
    .insert({ user_id: user.id, difficulty: difficulty.data, status: "CRIADA", public_briefing: publicBriefing })
    .select("id")
    .single();

  if (sessionError || !session) throw new Error("Não foi possível preparar a ocorrência.");

  const { error: secretError } = await admin.from("training_session_secrets").insert({
    session_id: session.id,
    internal_case: internalCase,
    model_instructions: "TSE v0.3: ficha interna estável; revelação gradual; sem expor conteúdo oculto.",
    prompt_version: "tse-v0.3-local-seed-1",
  });
  if (secretError) {
    await admin.from("training_sessions").delete().eq("id", session.id);
    throw new Error("Não foi possível proteger a ficha interna da ocorrência.");
  }

  redirect(`/app/sessions/${session.id}`);
}
