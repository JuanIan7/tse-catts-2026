"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAnnotationType, selectedTextForRange } from "@/lib/admin/evaluation-review";
import { recalculateEvaluationFromAnnotations } from "@/lib/admin/recalculate-evaluation";
import { appealStatusFor } from "@/lib/admin/evaluation-appeal";
import { adminNotificationAddress, sendEvaluationEmail } from "@/lib/notifications/evaluation-email";

const allowed = new Set(["APROVADO", "RECUSADO", "BLOQUEADO"]);
const appealDecisions = new Set(["ACEITO", "REJEITADO"]);
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

async function logNotification(sessionId: string, kind: "ADMIN_FINISHED" | "ADMIN_REVIEW_REQUEST" | "STUDENT_RECALCULATED", recipient: string, sent: boolean, reason: string | null) {
  await createSupabaseAdminClient().from("evaluation_notification_log").insert({ session_id: sessionId, kind, recipient, status: sent ? "SENT" : reason?.includes("pendente") ? "PENDING" : "FAILED", error_message: reason });
}

export async function recalculateEvaluation(formData: FormData) {
  const { user, supabase } = await requireAdmin();
  const sessionId = required(formData, "sessionId");
  const [{ data: evaluation }, { data: annotations }] = await Promise.all([
    supabase.from("evaluations").select("session_id, final_score, calculation").eq("session_id", sessionId).maybeSingle(),
    supabase.from("admin_evaluation_annotations").select("id, session_id, transcript_id, annotation_type, start_offset, end_offset, selected_text, note").eq("session_id", sessionId),
  ]);
  if (!evaluation) throw new Error("Relatório de avaliação inválido.");
  const calculation = recalculateEvaluationFromAnnotations(evaluation.calculation as Parameters<typeof recalculateEvaluationFromAnnotations>[0], (annotations ?? []).map((annotation) => ({ id: annotation.id, sessionId: annotation.session_id, transcriptId: annotation.transcript_id, annotationType: annotation.annotation_type, startOffset: annotation.start_offset, endOffset: annotation.end_offset, selectedText: annotation.selected_text, note: annotation.note })));
  const { error } = await supabase.rpc("apply_admin_evaluation_recalculation", { p_session_id: sessionId, p_previous_score: evaluation.final_score, p_recalculated_score: calculation.nota_final, p_previous_calculation: evaluation.calculation, p_recalculated_calculation: calculation, p_reviewed_by: user.id });
  if (error) throw new Error("Não foi possível registrar o recálculo. Execute a migração administrativa no Supabase.");
  await supabase.from("evaluation_appeals").update({ recalculated_score: calculation.nota_final }).eq("session_id", sessionId).in("status", ["ACEITO", "PARCIAL"]);
  revalidatePath("/admin");
  revalidatePath(`/app/sessions/${sessionId}`);
}

export async function previewAppealRecalculation(formData: FormData) {
  const { supabase } = await requireAdmin();
  const sessionId = required(formData, "sessionId");
  const [{ data: evaluation }, { data: annotations }, { data: appeals }] = await Promise.all([
    supabase.from("evaluations").select("session_id, calculation").eq("session_id", sessionId).maybeSingle(),
    supabase.from("admin_evaluation_annotations").select("id, session_id, transcript_id, annotation_type, start_offset, end_offset, selected_text, note").eq("session_id", sessionId),
    supabase.from("evaluation_appeals").select("id, status").eq("session_id", sessionId).in("status", ["ACEITO", "PARCIAL"]),
  ]);
  if (!evaluation || !appeals?.length) throw new Error("Não há recurso decidido para calcular a prévia.");
  const calculation = recalculateEvaluationFromAnnotations(evaluation.calculation as Parameters<typeof recalculateEvaluationFromAnnotations>[0], (annotations ?? []).map((annotation) => ({ id: annotation.id, sessionId: annotation.session_id, transcriptId: annotation.transcript_id, annotationType: annotation.annotation_type, startOffset: annotation.start_offset, endOffset: annotation.end_offset, selectedText: annotation.selected_text, note: annotation.note })));
  const { error } = await supabase.from("evaluation_appeals").update({ recalculated_score: calculation.nota_final }).eq("session_id", sessionId).in("status", ["ACEITO", "PARCIAL"]);
  if (error) throw new Error("Não foi possível salvar a prévia do recurso.");
  revalidatePath("/admin");
}

export async function decideEvaluationAppealItem(formData: FormData) {
  const { user, supabase } = await requireAdmin();
  const appealId = required(formData, "appealId");
  const itemId = required(formData, "appealItemId");
  const decision = required(formData, "decision");
  if (!appealDecisions.has(decision)) throw new Error("Decisão de recurso inválida.");

  const { data: item, error: itemError } = await supabase
    .from("evaluation_appeal_items")
    .select("id, appeal_id, transcript_id, annotation_type, selected_text, accepted_annotation_id, evaluation_appeals!inner(session_id)")
    .eq("id", itemId).eq("appeal_id", appealId).maybeSingle();
  if (itemError || !item) throw new Error("Item de recurso não encontrado.");
  const joinedAppeal = Array.isArray(item.evaluation_appeals) ? item.evaluation_appeals[0] : item.evaluation_appeals;
  const sessionId = (joinedAppeal as { session_id?: string } | null)?.session_id;
  if (!sessionId) throw new Error("Recurso sem sessão associada.");
  await requireEvaluatedSession(supabase, sessionId);

  let acceptedAnnotationId: string | null = item.accepted_annotation_id;
  if (decision === "ACEITO") {
    const { data: existing, error: existingError } = await supabase.from("admin_evaluation_annotations").select("id").eq("transcript_id", item.transcript_id).eq("annotation_type", item.annotation_type).eq("start_offset", 0).eq("end_offset", Array.from(item.selected_text).length).maybeSingle();
    if (existingError) throw new Error("Não foi possível validar a marcação aprovada.");
    if (!existing) {
      const { data: created, error: annotationError } = await supabase.from("admin_evaluation_annotations").insert({
        session_id: sessionId, transcript_id: item.transcript_id, annotation_type: item.annotation_type,
        start_offset: 0, end_offset: Array.from(item.selected_text).length, selected_text: item.selected_text,
        note: "Marcação aceita a partir de recurso do aluno.", created_by: user.id,
      }).select("id").single();
      if (annotationError || !created) throw new Error("Não foi possível aplicar a marcação aprovada.");
      acceptedAnnotationId = created.id;
    } else if (!acceptedAnnotationId) acceptedAnnotationId = null;
  } else if (acceptedAnnotationId) {
    const { error: deleteError } = await supabase.from("admin_evaluation_annotations").delete().eq("id", acceptedAnnotationId).eq("session_id", sessionId);
    if (deleteError) throw new Error("Não foi possível remover a marcação rejeitada.");
    acceptedAnnotationId = null;
  }

  const { error: updateError } = await supabase.from("evaluation_appeal_items").update({ decision, accepted_annotation_id: acceptedAnnotationId, decided_by: user.id, decided_at: new Date().toISOString() }).eq("id", itemId).eq("appeal_id", appealId);
  if (updateError) throw new Error("Não foi possível registrar a decisão do recurso.");
  const { data: allItems } = await supabase.from("evaluation_appeal_items").select("decision").eq("appeal_id", appealId);
  const status = appealStatusFor((allItems ?? []).map((entry) => entry.decision));
  const { error: appealError } = await supabase.from("evaluation_appeals").update({ status, reviewed_by: user.id, reviewed_at: status === "PENDENTE" ? null : new Date().toISOString() }).eq("id", appealId);
  if (appealError) throw new Error("Não foi possível atualizar o recurso.");
  revalidatePath("/admin");
}

export async function sendRecalculatedEvaluationEmail(formData: FormData) {
  await requireAdmin();
  const sessionId = required(formData, "sessionId");
  const admin = createSupabaseAdminClient();
  const [{ data: evaluation }, { data: review, error: reviewError }] = await Promise.all([
    admin.from("evaluations").select("user_id, final_score, result").eq("session_id", sessionId).maybeSingle(),
    admin.from("evaluation_manual_reviews").select("id").eq("session_id", sessionId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (!evaluation) throw new Error("Relatório de avaliação inválido.");
  if (reviewError) throw new Error("Não foi possível confirmar o recálculo da avaliação.");
  if (!review) throw new Error("Aplique a nota recalculada antes de enviá-la por e-mail.");
  const { data: account, error: accountError } = await admin.auth.admin.getUserById(evaluation.user_id);
  if (accountError || !account.user?.email) throw new Error(`Não foi possível localizar o e-mail do aluno${accountError?.message ? `: ${accountError.message}` : "."}`);
  const mail = await sendEvaluationEmail({ to: account.user.email, subject: "CATTS — nota de abordagem atualizada", text: `Sua avaliação foi revisada pelo administrador. Nota atualizada: ${Number(evaluation.final_score).toFixed(1)} / 10. Acesse o CATTS para consultar o relatório.` });
  try { await logNotification(sessionId, "STUDENT_RECALCULATED", account.user.email, mail.sent, mail.reason); } catch { /* O e-mail já foi processado; falha de auditoria não deve provocar reenvio. */ }
  if (!mail.sent) throw new Error(mail.reason ?? "Não foi possível enviar o e-mail.");
  revalidatePath("/admin");
}

export async function notifyAdminOfCompletedEvaluation(input: { sessionId: string; studentName: string; finalScore: number }) {
  const recipient = adminNotificationAddress();
  const mail = await sendEvaluationEmail({ to: recipient, subject: "CATTS — abordagem finalizada para revisão", text: `${input.studentName} concluiu uma abordagem com nota ${input.finalScore.toFixed(1)} / 10. Revise no painel administrativo.` });
  try { await logNotification(input.sessionId, "ADMIN_FINISHED", recipient, mail.sent, mail.reason); } catch { /* A avaliação já foi concluída; o log é complementar. */ }
}
