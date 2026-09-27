import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AdminEvaluationReview, type AdminReviewSession } from "@/components/admin-evaluation-review";
import { requireAdmin } from "@/lib/auth/authorization";
import { inviteUser, reviewAccess, sendPasswordReset } from "./actions";
import { normalizePublicBriefing } from "@/lib/tse/briefing";
import type { AnnotationType } from "@/lib/admin/evaluation-review";

type RequestRow = { user_id: string; requested_name: string; requested_email: string; requested_at: string; decision: string };
type EvaluationRow = { session_id: string; user_id: string; result: string; final_score: number; calculation: AdminReviewSession["evaluation"]["calculation"]; created_at: string };
type SessionRow = { id: string; difficulty: "FACIL" | "MEDIA" | "DIFICIL"; ended_at: string | null; public_briefing: unknown };
type TranscriptRow = { id: string; session_id: string; speaker: "ALUNO" | "PERSONAGEM" | "NARRADOR" | "SISTEMA"; content: string };
type AnnotationRow = { id: string; session_id: string; transcript_id: string; annotation_type: AnnotationType; start_offset: number; end_offset: number; selected_text: string; note: string | null };
type GeneralNoteRow = { session_id: string; note: string };
const difficultyLabel: Record<SessionRow["difficulty"], string> = { FACIL: "Médio", MEDIA: "Difícil", DIFICIL: "Muito difícil" };

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("access_requests").select("user_id, requested_name, requested_email, requested_at, decision").order("requested_at", { ascending: false });
  if (error) throw new Error("Não foi possível consultar solicitações.");
  const requests = (data ?? []) as RequestRow[];
  const { data: evaluationData } = await supabase.from("evaluations").select("session_id, user_id, result, final_score, calculation, created_at").order("created_at", { ascending: false }).limit(5);
  const evaluations = (evaluationData ?? []) as EvaluationRow[];
  const sessionIds = evaluations.map((evaluation) => evaluation.session_id);
  const userIds = [...new Set(evaluations.map((evaluation) => evaluation.user_id))];
  const [sessionResult, transcriptResult, profileResult, annotationResult, noteResult] = sessionIds.length > 0 ? await Promise.all([
    supabase.from("training_sessions").select("id, difficulty, ended_at, public_briefing").in("id", sessionIds),
    supabase.from("training_transcripts").select("id, session_id, speaker, content, sequence_number").in("session_id", sessionIds).order("sequence_number", { ascending: true }),
    supabase.from("profiles").select("user_id, display_name").in("user_id", userIds),
    supabase.from("admin_evaluation_annotations").select("id, session_id, transcript_id, annotation_type, start_offset, end_offset, selected_text, note").in("session_id", sessionIds),
    supabase.from("admin_evaluation_notes").select("session_id, note").in("session_id", sessionIds),
  ]) : [null, null, null, null, null];
  const sessionRows = ((sessionResult?.data ?? []) as SessionRow[]);
  const transcriptRows = ((transcriptResult?.data ?? []) as TranscriptRow[]);
  const profiles = new Map(((profileResult?.data ?? []) as { user_id: string; display_name: string }[]).map((profile) => [profile.user_id, profile.display_name]));
  const annotations = (annotationResult?.data ?? []) as AnnotationRow[];
  const notes = new Map(((noteResult?.data ?? []) as GeneralNoteRow[]).map((note) => [note.session_id, note.note]));
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
    }];
  });
  return <AppShell backHref="/app" backLabel="Painel do aluno">
    <div className="admin-panel"><section className="admin-heading"><div><div className="eyebrow">Acesso e acompanhamento</div><h1>Painel administrativo</h1><p className="panel-subtitle">Senhas nunca são exibidas. Convites e redefinições são enviados pelo provedor de autenticação.</p></div><Link href="/app">Abrir simulador</Link></section>
    <p className="notice">Confirme sempre nome e e-mail antes de aprovar. A decisão passa a valer na próxima requisição autenticada.</p>
    <section className="panel"><h2>Cadastrar e convidar</h2><form action={inviteUser}><label>Nome<input name="displayName" required minLength={2}/></label><label>E-mail<input name="email" type="email" required/></label><button type="submit">Enviar convite</button></form></section>
    <section className="panel"><h2>Solicitações de acesso</h2>{requests.length === 0 ? <p className="panel-subtitle">Nenhuma solicitação registrada.</p> : <div className="table-wrap"><table><thead><tr><th>Solicitante</th><th>E-mail</th><th>Data</th><th>Situação</th><th>Acesso</th><th>Senha</th></tr></thead><tbody>{requests.map((request) => <tr key={request.user_id}><td>{request.requested_name}</td><td>{request.requested_email}</td><td>{new Date(request.requested_at).toLocaleDateString("pt-BR")}</td><td><span className="status-badge">{request.decision}</span></td><td><form action={reviewAccess}><input type="hidden" name="userId" value={request.user_id}/><select name="decision" defaultValue={request.decision}><option value="APROVADO">Aprovar</option><option value="RECUSADO">Recusar</option><option value="BLOQUEADO">Bloquear</option></select><button type="submit">Salvar</button></form></td><td><form action={sendPasswordReset}><input type="hidden" name="userId" value={request.user_id}/><button type="submit">Redefinir</button></form></td></tr>)}</tbody></table></div>}</section>
    <AdminEvaluationReview sessions={reviews}/></div>
  </AppShell>;
}
