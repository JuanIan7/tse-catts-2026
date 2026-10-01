"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireApprovedUser } from "@/lib/auth/authorization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { finalizeManualTrainingSession, recordStudentTurn } from "@/lib/tse/conversation";
import { createSessionCase, difficultySchema, openingCharacterLine, type CharacterProfile } from "@/lib/tse/session-case";
import { adminNotificationAddress, sendEvaluationEmail } from "@/lib/notifications/evaluation-email";

const reviewRequestTools = new Set(["PARAFRASE", "MEMORIA_LINKADA", "MAIEUTICA_TED", "SAIDA_DIGNA", "DOMINOU_DIALOGO", "CONDUZIU_SOLUCAO", "PERGUNTA_SIMPLES", "PERGUNTA_COMPLEXA", "FATOR_PROTECAO", "FATOR_RISCO", "FATOR_PRINCIPAL"]);
export type EvaluationAppealPayload = { sessionId: string; transcriptIds: string[]; tools: string[] };
export type EvaluationAppealResult = { ok: boolean; message: string };

export async function createTrainingSession(formData: FormData) {
  const difficulty = difficultySchema.safeParse(String(formData.get("difficulty") ?? ""));
  if (!difficulty.success) throw new Error("Dificuldade inválida.");
  const { user } = await requireApprovedUser();
  const admin = createSupabaseAdminClient();
  const { data: recentSessions } = await admin.from("training_sessions").select("id, public_briefing").eq("user_id", user.id).order("created_at", { ascending: false }).limit(3);
  const recentTitles = (recentSessions ?? []).flatMap((row) => {
    const briefing = row.public_briefing as { titulo?: unknown } | null;
    return typeof briefing?.titulo === "string" ? [briefing.titulo] : [];
  });
  const latestSessionId = recentSessions?.[0]?.id;
  let lastProfile: CharacterProfile | undefined;
  if (latestSessionId) {
    const { data: latestSecret } = await admin.from("training_session_secrets").select("internal_case").eq("session_id", latestSessionId).maybeSingle();
    const profile = (latestSecret?.internal_case as { perfil_tipo?: unknown } | null)?.perfil_tipo;
    if (profile === "DEPRESSIVO" || profile === "AGRESSIVO" || profile === "PSICOTICO") lastProfile = profile;
  }
  const { internalCase, publicBriefing } = createSessionCase(difficulty.data, Math.random, recentTitles, lastProfile);
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

export async function submitEvaluationReviewRequest(formData: FormData) {
  const sessionId = String(formData.get("sessionId") ?? "");
  const tools = formData.getAll("tools").map(String).filter((tool) => reviewRequestTools.has(tool));
  if (!sessionId || tools.length === 0) throw new Error("Selecione ao menos uma ferramenta.");
  const { user } = await requireApprovedUser();
  const admin = createSupabaseAdminClient();
  const { data: evaluation } = await admin.from("evaluations").select("session_id").eq("session_id", sessionId).eq("user_id", user.id).maybeSingle();
  if (!evaluation) throw new Error("Avaliação indisponível.");
  const { error } = await admin.from("evaluation_review_requests").insert({ session_id: sessionId, user_id: user.id, tools });
  if (error) throw new Error("Não foi possível enviar o apontamento. Execute a migração administrativa no Supabase.");
  try {
    const recipient = adminNotificationAddress();
    const { data: profile } = await admin.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
    const mail = await sendEvaluationEmail({ to: recipient, subject: "CATTS — ferramenta possivelmente não avaliada", text: `${profile?.display_name ?? "Aluno"} enviou um apontamento para a sessão ${sessionId}. Ferramentas indicadas: ${tools.join(", ")}. Consulte o painel administrativo.` });
    await admin.from("evaluation_notification_log").insert({ session_id: sessionId, kind: "ADMIN_REVIEW_REQUEST", recipient, status: mail.sent ? "SENT" : mail.reason?.includes("pendente") ? "PENDING" : "FAILED", error_message: mail.reason });
  } catch { /* O apontamento já foi salvo e não deve gerar duplicidade por falha de e-mail. */ }
  revalidatePath(`/app/sessions/${sessionId}`);
}

export async function submitEvaluationAppeal(payload: EvaluationAppealPayload): Promise<EvaluationAppealResult> {
  const sessionId = payload.sessionId.trim();
  const transcriptIds = [...new Set(payload.transcriptIds.filter(Boolean))];
  const tools = [...new Set(payload.tools.filter((tool) => reviewRequestTools.has(tool)))];
  if (!sessionId || transcriptIds.length === 0 || tools.length === 0) return { ok: false, message: "Selecione ao menos uma fala e uma ferramenta para enviar o recurso." };

  try {
    const { user, supabase } = await requireApprovedUser();
    const { error } = await supabase.rpc("create_evaluation_appeal", {
      p_session_id: sessionId,
      p_transcript_ids: transcriptIds,
      p_annotation_types: tools,
    });
    if (error) return { ok: false, message: "Não foi possível registrar o recurso. Verifique a migração de recursos e tente novamente." };

    let notificationWarning = "";
    try {
      const admin = createSupabaseAdminClient();
      const recipient = adminNotificationAddress();
      const { data: profile } = await admin.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
      const mail = await sendEvaluationEmail({ to: recipient, subject: "CATTS — recurso de nota aguardando revisão", text: `${profile?.display_name ?? "Aluno"} enviou um recurso para a sessão ${sessionId}, com ${transcriptIds.length} fala(s) e ${tools.length} ferramenta(s). Consulte o painel administrativo.` });
      await admin.from("evaluation_notification_log").insert({ session_id: sessionId, kind: "ADMIN_REVIEW_REQUEST", recipient, status: mail.sent ? "SENT" : mail.reason?.includes("pendente") ? "PENDING" : "FAILED", error_message: mail.reason });
      if (!mail.sent) notificationWarning = " O recurso foi salvo; o aviso por e-mail está pendente no painel.";
    } catch {
      notificationWarning = " O recurso foi salvo; o aviso por e-mail ficará pendente no painel.";
    }
    revalidatePath(`/app/sessions/${sessionId}`);
    return { ok: true, message: `Recurso enviado para revisão.${notificationWarning}` };
  } catch (cause) {
    return { ok: false, message: cause instanceof Error && cause.message ? cause.message : "Não foi possível enviar o recurso. Tente novamente." };
  }
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
