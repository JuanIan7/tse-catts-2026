"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { recordStudentTurn } from "@/lib/tse/conversation";
import { generatePovImage } from "@/lib/tse/pov-image";
import { createSessionCase, difficultySchema } from "@/lib/tse/session-case";

export async function createTrainingSession(formData: FormData) {
  const difficulty = difficultySchema.safeParse(String(formData.get("difficulty") ?? ""));
  if (!difficulty.success) throw new Error("Dificuldade inválida.");
  const { user } = await requireApprovedUser();
  const { internalCase, publicBriefing } = createSessionCase(difficulty.data);
  const admin = createSupabaseAdminClient();
  const { data: session, error: sessionError } = await admin.from("training_sessions").insert({ user_id: user.id, difficulty: difficulty.data, status: "CRIADA", public_briefing: publicBriefing, scenario_version: "tse-safe-seed-2026-09-24" }).select("id").single();
  if (sessionError || !session) throw new Error("Não foi possível preparar a ocorrência.");
  const { error: secretError } = await admin.from("training_session_secrets").insert({ session_id: session.id, internal_case: internalCase, model_instructions: "TSE: ficha interna estável; revelação gradual; sem expor conteúdo oculto.", prompt_version: "tse-safe-seed-2026-09-24" });
  if (secretError) { await admin.from("training_sessions").delete().eq("id", session.id); throw new Error("Não foi possível proteger a ficha interna da ocorrência."); }
  try {
    const path = `${session.id}/pov.webp`;
    const bytes = await generatePovImage(publicBriefing);
    const { error: imageError } = await admin.storage.from("tse-session-images").upload(path, bytes, { contentType: "image/webp", upsert: false });
    if (imageError) throw imageError;
    await admin.from("training_sessions").update({ image_path: path }).eq("id", session.id);
  } catch {
    // A imagem é complementar. O console usa um fallback visual seguro quando ela não estiver disponível.
  }
  redirect(`/app/sessions/${session.id}`);
}

export async function sendTrainingTurn(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const content = String(formData.get("content") ?? "");
  const { user } = await requireApprovedUser();
  await recordStudentTurn({ userId: user.id, sessionId, content, source: "TEXTO" });
  revalidatePath(`/app/sessions/${sessionId}`);
}
