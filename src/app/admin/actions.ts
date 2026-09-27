"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAnnotationType, selectedTextForRange } from "@/lib/admin/evaluation-review";

const allowed = new Set(["APROVADO", "RECUSADO", "BLOQUEADO"]);
const passwordConfirmationUrl = async () => `${(await headers()).get("origin") ?? "http://localhost:3000"}/auth/confirm?next=/password/change`;

export async function inviteUser(formData: FormData) {
  await requireAdmin();
  const email = String(formData.get("email") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!email || !displayName) throw new Error("Nome e e-mail são obrigatórios.");

  const { error } = await createSupabaseAdminClient().auth.admin.inviteUserByEmail(email, {
    data: { display_name: displayName },
    redirectTo: await passwordConfirmationUrl(),
  });

  if (error) throw new Error(`Não foi possível enviar o convite: ${error.message}`);
  revalidatePath("/admin");
}

export async function sendPasswordReset(formData: FormData) {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("Usuário inválido.");
  const admin = createSupabaseAdminClient();
  const { data, error: userError } = await admin.auth.admin.getUserById(userId);
  if (userError || !data.user?.email) throw new Error("Não foi possível localizar o e-mail do usuário.");
  const { error } = await admin.auth.resetPasswordForEmail(data.user.email, { redirectTo: await passwordConfirmationUrl() });
  if (error) throw new Error(`Não foi possível enviar a redefinição: ${error.message}`);
  revalidatePath("/admin");
}

export async function reviewAccess(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!userId || !allowed.has(decision)) throw new Error("Decisão inválida.");
  const { user } = await requireAdmin();
  const admin = createSupabaseAdminClient();
  const { error: profileError } = await admin.from("profiles").update({ access_status: decision }).eq("user_id", userId);
  if (profileError) throw new Error("Não foi possível atualizar o acesso.");
  const { error: requestError } = await admin.from("access_requests").update({ decision, reviewed_at: new Date().toISOString(), reviewed_by: user.id }).eq("user_id", userId);
  if (requestError) throw new Error("O histórico não foi atualizado.");
  revalidatePath("/admin");
}

const required = (formData: FormData, name: string) => {
  const value = String(formData.get(name) ?? "").trim();
  if (!value) throw new Error("Dados de revisão incompletos.");
  return value;
};

const requireEvaluatedSession = async (supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"], sessionId: string) => {
  const { data, error } = await supabase.from("evaluations").select("session_id").eq("session_id", sessionId).maybeSingle();
  if (error || !data) throw new Error("Relatório de avaliação inválido.");
};

export async function saveEvaluationAnnotation(formData: FormData) {
  const { user, supabase } = await requireAdmin();
  const sessionId = required(formData, "sessionId");
  const transcriptId = required(formData, "transcriptId");
  const annotationType = required(formData, "annotationType");
  const startOffset = Number(formData.get("startOffset"));
  const endOffset = Number(formData.get("endOffset"));
  const submittedText = required(formData, "selectedText");
  const note = String(formData.get("note") ?? "").trim();
  if (!isAnnotationType(annotationType) || note.length > 1500) throw new Error("Marcação inválida.");
  await requireEvaluatedSession(supabase, sessionId);

  const { data: turn, error: turnError } = await supabase
    .from("training_transcripts")
    .select("id, session_id, content")
    .eq("id", transcriptId)
    .eq("session_id", sessionId)
    .maybeSingle();
  if (turnError || !turn) throw new Error("Fala da transcrição inválida.");
  const exactText = selectedTextForRange(turn.content, startOffset, endOffset);
  if (!exactText || exactText !== submittedText) throw new Error("O trecho selecionado não corresponde à transcrição.");

  const { data: saved, error: savedError } = await supabase
    .from("admin_evaluation_annotations")
    .select("annotation_type, start_offset, end_offset")
    .eq("transcript_id", transcriptId)
    .eq("annotation_type", annotationType)
    .eq("start_offset", startOffset)
    .eq("end_offset", endOffset);
  if (savedError) throw new Error("Não foi possível validar as marcações existentes.");
  if ((saved ?? []).length > 0) {
    throw new Error("Esta ferramenta já foi aplicada a esta fala.");
  }

  const { error } = await supabase.from("admin_evaluation_annotations").insert({
    session_id: sessionId,
    transcript_id: transcriptId,
    annotation_type: annotationType,
    start_offset: startOffset,
    end_offset: endOffset,
    selected_text: exactText,
    note: note || null,
    created_by: user.id,
  });
  if (error) throw new Error("Não foi possível salvar a marcação.");
  revalidatePath("/admin");
}

export async function deleteEvaluationAnnotation(formData: FormData) {
  const { supabase } = await requireAdmin();
  const sessionId = required(formData, "sessionId");
  const annotationId = required(formData, "annotationId");
  await requireEvaluatedSession(supabase, sessionId);
  const { error } = await supabase.from("admin_evaluation_annotations").delete().eq("id", annotationId).eq("session_id", sessionId);
  if (error) throw new Error("Não foi possível remover a marcação.");
  revalidatePath("/admin");
}

export async function saveEvaluationReviewNote(formData: FormData) {
  const { user, supabase } = await requireAdmin();
  const sessionId = required(formData, "sessionId");
  const note = required(formData, "note");
  if (note.length > 3000) throw new Error("A observação geral é longa demais.");
  await requireEvaluatedSession(supabase, sessionId);
  const { error } = await supabase.from("admin_evaluation_notes").upsert({ session_id: sessionId, note, updated_by: user.id }, { onConflict: "session_id" });
  if (error) throw new Error("Não foi possível salvar a observação geral.");
  revalidatePath("/admin");
}
