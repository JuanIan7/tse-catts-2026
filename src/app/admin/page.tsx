import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AdminEvaluationReview, type AdminReviewSession } from "@/components/admin-evaluation-review-v2";
import { requireAdmin } from "@/lib/auth/authorization";
import { inviteUser, reviewAccess, sendPasswordReset } from "./actions";
import { normalizePublicBriefing } from "@/lib/tse/briefing";
import type { AnnotationType } from "@/lib/admin/evaluation-review";
import { appealSenderFor } from "@/lib/admin/evaluation-appeal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RequestRow = { user_id: string; requested_name: string; requested_email: string; requested_at: string; decision: string };
type EvaluationRow = { session_id: string; user_id: string; result: string; final_score: number; calculation: AdminReviewSession["evaluation"]["calculation"]; created_at: string };
type SessionRow = { id: string; difficulty: "FACIL" | "MEDIA" | "DIFICIL"; ended_at: string | null; public_briefing: unknown };
type TranscriptRow = { id: string; session_id: string; speaker: "ALUNO" | "PERSONAGEM" | "NARRADOR" | "SISTEMA"; content: string };
type AnnotationRow = { id: string; session_id: string; transcript_id: string; annotation_type: AnnotationType; start_offset: number; end_offset: number; selected_text: string; note: string | null };
type GeneralNoteRow = { session_id: string; note: string };
type AppealRow = { id: string; session_id: string; user_id: string; status: "PENDENTE" | "ACEITO" | "PARCIAL" | "REJEITADO"; created_at: string; previous_score: number; recalculated_score: number | null };
type AppealItemRow = { id: string; appeal_id: string; transcript_id: string; annotation_type: AnnotationType; selected_text: string; decision: "PENDENTE" | "ACEITO" | "REJEITADO"; created_at: string };
const difficultyLabel: Record<SessionRow["difficulty"], string> = { FACIL: "Médio", MEDIA: "Difícil", DIFICIL: "Muito difícil" };
type AccessStatus = "PENDENTE" | "APROVADO" | "RECUSADO" | "BLOQUEADO";

const accessStatusLabel: Record<AccessStatus, string> = {
  PENDENTE: "Aguardando análise",
  APROVADO: "Aprovado",
  RECUSADO: "Recusado",
  BLOQUEADO: "Bloqueado",
};

function accessStatusFor(decision: string): AccessStatus {
  if (decision === "APROVADO" || decision === "RECUSADO" || decision === "BLOQUEADO") return decision;
  return "PENDENTE";
}

function formatAccessRequestDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function AccessRequestIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" focusable="false">
    <path d="M4.5 4.5h15v15h-15z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M4.5 14.25h4.05l1.35 2.1h4.2l1.35-2.1h4.05" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8.5 9.25h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>;
}

function AccessRequestCard({ request }: { request: RequestRow }) {
  const status = accessStatusFor(request.decision);
  const isPending = status === "PENDENTE";
  const displayName = request.requested_name?.trim() || "Solicitante sem nome";
  const requestDate = formatAccessRequestDate(request.requested_at);
  const decisionFieldId = `access-decision-${request.user_id}`;

  return <article className={`access-request-card access-request-card-${status.toLowerCase()}`}>
    <div className="access-request-person">
      <span className="access-request-avatar" aria-hidden="true">{displayName.slice(0, 1).toLocaleUpperCase("pt-BR")}</span>
      <div className="access-request-identification">
        <div className="access-request-name-row">
          <h4>{displayName}</h4>
          <span className={`access-status-badge access-status-${status.toLowerCase()}`}>{accessStatusLabel[status]}</span>
        </div>
        <a href={`mailto:${request.requested_email}`}>{request.requested_email}</a>
        <p>Solicitação recebida em <time dateTime={request.requested_at}>{requestDate}</time></p>
      </div>
    </div>
    <div className="access-card-actions">
      {isPending ? <div className="access-decision-actions" aria-label={`Decidir acesso de ${displayName}`}>
        <form action={reviewAccess}><input type="hidden" name="userId" value={request.user_id}/><input type="hidden" name="decision" value="APROVADO"/><button className="access-button-approve" type="submit" aria-label={`Aprovar acesso de ${displayName}`}>Aprovar acesso</button></form>
        <form action={reviewAccess}><input type="hidden" name="userId" value={request.user_id}/><input type="hidden" name="decision" value="RECUSADO"/><button className="access-button-reject" type="submit" aria-label={`Recusar acesso de ${displayName}`}>Recusar</button></form>
        <form action={reviewAccess}><input type="hidden" name="userId" value={request.user_id}/><input type="hidden" name="decision" value="BLOQUEADO"/><button className="access-button-block" type="submit" aria-label={`Bloquear acesso de ${displayName}`}>Bloquear</button></form>
      </div> : <div className="access-reviewed-actions">
        <form action={reviewAccess} className="access-change-decision">
          <input type="hidden" name="userId" value={request.user_id}/>
          <label htmlFor={decisionFieldId}>Alterar decisão</label>
          <select id={decisionFieldId} name="decision" defaultValue={status}>
            <option value="APROVADO">Aprovar</option>
            <option value="RECUSADO">Recusar</option>
            <option value="BLOQUEADO">Bloquear</option>
          </select>
          <button type="submit">Salvar</button>
        </form>
      </div>}
      <form action={sendPasswordReset} className="access-reset-password">
        <input type="hidden" name="userId" value={request.user_id}/>
        <button type="submit">Enviar redefinição de senha</button>
      </form>
    </div>
  </article>;
}

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("access_requests").select("user_id, requested_name, requested_email, requested_at, decision").order("requested_at", { ascending: false });
  if (error) throw new Error("Não foi possível consultar solicitações.");
  const requests = (data ?? []) as RequestRow[];
  const pendingRequests = requests.filter((request) => accessStatusFor(request.decision) === "PENDENTE");
  const approvedRequests = requests.filter((request) => accessStatusFor(request.decision) === "APROVADO");
  const restrictedRequests = requests.filter((request) => {
    const status = accessStatusFor(request.decision);
    return status === "RECUSADO" || status === "BLOQUEADO";
  });
  const reviewedRequests = requests.filter((request) => accessStatusFor(request.decision) !== "PENDENTE");
  const [{ data: evaluationData }, { data: recentAppealData }] = await Promise.all([
    supabase.from("evaluations").select("session_id, user_id, result, final_score, calculation, created_at").order("created_at", { ascending: false }).limit(8),
    supabase.from("evaluation_appeals").select("session_id").order("created_at", { ascending: false }).limit(8),
  ]);
  const requestedSessionIds = [...new Set((recentAppealData ?? []).map((appeal) => appeal.session_id))];
  const initialEvaluations = (evaluationData ?? []) as EvaluationRow[];
  const missingRequestedIds = requestedSessionIds.filter((id) => !initialEvaluations.some((evaluation) => evaluation.session_id === id));
  const { data: requestedEvaluationData } = missingRequestedIds.length > 0
    ? await supabase.from("evaluations").select("session_id, user_id, result, final_score, calculation, created_at").in("session_id", missingRequestedIds)
    : { data: [] as EvaluationRow[] };
  const evaluations = [...initialEvaluations, ...((requestedEvaluationData ?? []) as EvaluationRow[])];
  const sessionIds = evaluations.map((evaluation) => evaluation.session_id);
  const [sessionResult, transcriptResult, annotationResult, noteResult, appealResult] = sessionIds.length > 0 ? await Promise.all([
    supabase.from("training_sessions").select("id, difficulty, ended_at, public_briefing").in("id", sessionIds),
    supabase.from("training_transcripts").select("id, session_id, speaker, content, sequence_number").in("session_id", sessionIds).order("sequence_number", { ascending: true }),
    supabase.from("admin_evaluation_annotations").select("id, session_id, transcript_id, annotation_type, start_offset, end_offset, selected_text, note").in("session_id", sessionIds),
    supabase.from("admin_evaluation_notes").select("session_id, note").in("session_id", sessionIds),
    supabase.from("evaluation_appeals").select("id, session_id, user_id, status, created_at, previous_score, recalculated_score").in("session_id", sessionIds).order("created_at", { ascending: false }),
  ]) : [null, null, null, null, null];
  const sessionRows = ((sessionResult?.data ?? []) as SessionRow[]);
  const transcriptRows = ((transcriptResult?.data ?? []) as TranscriptRow[]);
  const annotations = (annotationResult?.data ?? []) as AnnotationRow[];
  const notes = new Map(((noteResult?.data ?? []) as GeneralNoteRow[]).map((note) => [note.session_id, note.note]));
  const appeals = (appealResult?.data ?? []) as AppealRow[];
  const appealUserIds = [...new Set(appeals.map((appeal) => appeal.user_id))];
  const profileUserIds = [...new Set([...evaluations.map((evaluation) => evaluation.user_id), ...appealUserIds])];
  const { data: profileData } = profileUserIds.length > 0
    ? await supabase.from("profiles").select("user_id, display_name").in("user_id", profileUserIds)
    : { data: [] as { user_id: string; display_name: string }[] };
  const profiles = new Map(((profileData ?? []) as { user_id: string; display_name: string }[]).map((profile) => [profile.user_id, profile.display_name]));
  const emails = new Map<string, string>();
  try {
    const admin = createSupabaseAdminClient();
    await Promise.all(appealUserIds.map(async (userId) => {
      const { data: account } = await admin.auth.admin.getUserById(userId);
      if (account.user?.email) emails.set(userId, account.user.email);
    }));
  } catch { /* Mantém o fallback sem impedir a revisão administrativa. */ }
  const senders = new Map(appealUserIds.map((userId) => [userId, { name: profiles.get(userId), email: emails.get(userId) }]));
  const appealIds = appeals.map((appeal) => appeal.id);
  const { data: appealItemData } = appealIds.length > 0
    ? await supabase.from("evaluation_appeal_items").select("id, appeal_id, transcript_id, annotation_type, selected_text, decision, created_at").in("appeal_id", appealIds).order("created_at", { ascending: true })
    : { data: [] as AppealItemRow[] };
  const appealItems = (appealItemData ?? []) as AppealItemRow[];
  const sessionById = new Map(sessionRows.map((session) => [session.id, session]));
  const reviews: AdminReviewSession[] = evaluations.flatMap((evaluation) => {
    const session = sessionById.get(evaluation.session_id);
    if (!session) return [];
    const briefing = normalizePublicBriefing(session.public_briefing, session.difficulty);
    return [{
      id: session.id,
      title: briefing.titulo,
      difficulty: difficultyLabel[session.difficulty],
      completedAt: session.ended_at ?? evaluation.created_at,
      studentName: profiles.get(evaluation.user_id) ?? "Aluno",
      transcript: transcriptRows.filter((turn) => turn.session_id === session.id),
      evaluation: { result: evaluation.result, finalScore: Number(evaluation.final_score), calculation: evaluation.calculation },
      annotations: annotations.filter((annotation) => annotation.session_id === session.id).map((annotation) => ({ id: annotation.id, sessionId: annotation.session_id, transcriptId: annotation.transcript_id, annotationType: annotation.annotation_type, startOffset: annotation.start_offset, endOffset: annotation.end_offset, selectedText: annotation.selected_text, note: annotation.note })),
      generalNote: notes.get(session.id) ?? null,
      appeals: appeals.filter((appeal) => appeal.session_id === session.id).map((appeal) => {
        const sender = appealSenderFor(appeal.user_id, senders);
        return { id: appeal.id, status: appeal.status, createdAt: appeal.created_at, senderName: sender.name, senderEmail: sender.email, previousScore: Number(appeal.previous_score), recalculatedScore: appeal.recalculated_score === null ? null : Number(appeal.recalculated_score), items: appealItems.filter((item) => item.appeal_id === appeal.id).map((item) => ({ id: item.id, transcriptId: item.transcript_id, annotationType: item.annotation_type, selectedText: item.selected_text, decision: item.decision })) };
      }),
    }];
  });
  return <AppShell backHref="/app" backLabel="Painel do aluno">
    <div className="admin-panel"><section className="admin-heading"><div><div className="eyebrow">Acesso e acompanhamento</div><h1>Painel administrativo</h1><p className="panel-subtitle">Senhas nunca são exibidas. Convites e redefinições são enviados pelo provedor de autenticação.</p></div><Link href="/app">Abrir simulador</Link></section>
    <p className="notice">Confirme sempre nome e e-mail antes de aprovar. A decisão passa a valer na próxima requisição autenticada.</p>
    <section className="panel"><h2>Cadastrar e convidar</h2><form action={inviteUser}><label>Nome<input name="displayName" required minLength={2}/></label><label>E-mail<input name="email" type="email" required/></label><button type="submit">Enviar convite</button></form></section>
    <section className="panel access-requests" aria-labelledby="access-requests-title">
      <div className="access-requests-heading">
        <div className="access-heading-title">
          <span className="access-section-icon"><AccessRequestIcon /></span>
          <div>
            <div className="eyebrow">Controle de acesso</div>
            <h2 id="access-requests-title">Solicitações de acesso</h2>
            <p className="panel-subtitle">Analise primeiro quem está aguardando. As solicitações já tratadas ficam agrupadas abaixo.</p>
          </div>
        </div>
        <span className={`access-pending-counter${pendingRequests.length > 0 ? "" : " access-pending-counter-empty"}`}>
          <strong>{pendingRequests.length}</strong> {pendingRequests.length === 1 ? "pendente" : "pendentes"}
        </span>
      </div>
      <div className="access-summary" aria-label="Resumo das solicitações de acesso">
        <div className="access-summary-card access-summary-pending"><strong>{pendingRequests.length}</strong><span>Pendentes</span></div>
        <div className="access-summary-card access-summary-approved"><strong>{approvedRequests.length}</strong><span>Aprovadas</span></div>
        <div className="access-summary-card access-summary-restricted"><strong>{restrictedRequests.length}</strong><span>Recusadas ou bloqueadas</span></div>
      </div>
      {requests.length === 0 ? <div className="access-empty-state"><span className="access-section-icon"><AccessRequestIcon /></span><div><h3>Nenhuma solicitação por enquanto</h3><p className="panel-subtitle">Quando um aluno pedir acesso, a solicitação aparecerá aqui para revisão.</p></div></div> : <>
        <div className="access-group access-group-pending">
          <div className="access-group-heading">
            <div><h3>Para analisar agora</h3><p>Confirme os dados e escolha uma decisão para cada solicitante.</p></div>
            {pendingRequests.length > 0 && <span>{pendingRequests.length} aguardando</span>}
          </div>
          {pendingRequests.length === 0 ? <p className="access-group-empty">Não há solicitações aguardando análise.</p> : <div className="access-request-list">{pendingRequests.map((request) => <AccessRequestCard key={request.user_id} request={request}/>)}</div>}
        </div>
        {reviewedRequests.length > 0 && <details className="access-reviewed-history">
          <summary><span>Solicitações já tratadas</span><small>{reviewedRequests.length} {reviewedRequests.length === 1 ? "registro" : "registros"}</small></summary>
          <p className="access-reviewed-description">Use esta área para consultar ou alterar uma decisão anterior e reenviar uma redefinição de senha.</p>
          <div className="access-request-list access-request-list-reviewed">{reviewedRequests.map((request) => <AccessRequestCard key={request.user_id} request={request}/>)}</div>
        </details>}
      </>}
    </section>
    <AdminEvaluationReview sessions={reviews}/></div>
  </AppShell>;
}
