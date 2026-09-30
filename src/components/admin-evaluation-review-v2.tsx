"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { decideEvaluationAppealItem, deleteEvaluationAnnotation, previewAppealRecalculation, recalculateEvaluation, saveEvaluationAnnotation, saveEvaluationReviewNote, sendRecalculatedEvaluationEmail } from "@/app/admin/actions";
import { annotationMeta, annotationTypes, type AnnotationType, type ReviewAnnotation } from "@/lib/admin/evaluation-review";
import { ExportSessionPdf } from "@/components/export-session-pdf";

type Turn = { id: string; speaker: "ALUNO" | "PERSONAGEM" | "NARRADOR" | "SISTEMA"; content: string };
type Evaluation = { result: string; finalScore: number; calculation: { ficha_caso?: { fator_principal: string; fatores_risco: string[]; fatores_protecao: string[] }; itens?: { titulo: string; estado: string; ajuste: number; evidencia: string }[]; acertos?: string[]; melhorias?: string[] } };
type AppealItem = { id: string; transcriptId: string; annotationType: AnnotationType; selectedText: string; decision: "PENDENTE" | "ACEITO" | "REJEITADO" };
type Appeal = { id: string; status: "PENDENTE" | "ACEITO" | "PARCIAL" | "REJEITADO"; createdAt: string; previousScore: number; recalculatedScore: number | null; items: AppealItem[] };
export type AdminReviewSession = { id: string; title: string; difficulty: string; completedAt: string; studentName: string; transcript: Turn[]; evaluation: Evaluation; annotations: ReviewAnnotation[]; generalNote: string | null; appeals: Appeal[] };
type Selection = { transcriptId: string; startOffset: number; endOffset: number; selectedText: string };

const labels: Record<Turn["speaker"], string> = { ALUNO: "Você", PERSONAGEM: "Tentante", NARRADOR: "Narrador", SISTEMA: "Sistema" };
const time = (value: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
const selectionFor = (turn: Turn): Selection => ({ transcriptId: turn.id, startOffset: 0, endOffset: Array.from(turn.content).length, selectedText: turn.content });

export function AdminEvaluationReview({ sessions }: { sessions: AdminReviewSession[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(sessions[0]?.id ?? "");
  const [selections, setSelections] = useState<Selection[]>([]);
  const [note, setNote] = useState("");
  const [drafts, setDrafts] = useState<ReviewAnnotation[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const counter = useRef(0);
  const selected = sessions.find((session) => session.id === selectedId);
  const annotations = useMemo(() => [...(selected?.annotations ?? []), ...drafts.filter((draft) => draft.sessionId === selected?.id)], [drafts, selected]);
  const byTurn = useMemo(() => {
    const map = new Map<string, ReviewAnnotation[]>();
    annotations.forEach((annotation) => map.set(annotation.transcriptId, [...(map.get(annotation.transcriptId) ?? []), annotation]));
    return map;
  }, [annotations]);
  const pending = drafts.filter((draft) => draft.sessionId === selected?.id);
  if (!selected) return <section className="panel"><h2>Revisão de avaliações</h2><p className="panel-subtitle">Ainda não há relatórios concluídos para revisar.</p></section>;

  const selectedTurn = (id: string) => selections.some((selection) => selection.transcriptId === id);
  const toggleTurn = (turn: Turn) => setSelections((current) => selectedTurn(turn.id) ? current.filter((selection) => selection.transcriptId !== turn.id) : [...current, selectionFor(turn)]);
  const applyTool = (annotationType: AnnotationType) => {
    if (selections.length === 0) return;
    const additions = selections
      .filter((selection) => !annotations.some((annotation) => annotation.transcriptId === selection.transcriptId && annotation.annotationType === annotationType && annotation.startOffset === selection.startOffset && annotation.endOffset === selection.endOffset))
      .map((selection) => ({ id: `draft-${counter.current++}`, sessionId: selected.id, transcriptId: selection.transcriptId, annotationType, startOffset: selection.startOffset, endOffset: selection.endOffset, selectedText: selection.selectedText, note: note.trim() || null }));
    if (additions.length === 0) return setMessage("Essa ferramenta já está aplicada às falas selecionadas.");
    setDrafts((current) => [...current, ...additions]);
    setMessage(`${annotationMeta[annotationType].label} aplicada a ${additions.length} fala(s). A seleção permanece ativa.`);
  };
  const saveDrafts = async () => {
    setSaving(true);
    const saved: string[] = [];
    for (const annotation of pending) {
      const form = new FormData();
      Object.entries({ sessionId: annotation.sessionId, transcriptId: annotation.transcriptId, annotationType: annotation.annotationType, startOffset: String(annotation.startOffset), endOffset: String(annotation.endOffset), selectedText: annotation.selectedText, note: annotation.note ?? "" }).forEach(([key, value]) => form.set(key, value));
      try { await saveEvaluationAnnotation(form); saved.push(annotation.id); } catch { /* Mantém a marcação visível para nova tentativa. */ }
    }
    setDrafts((current) => current.filter((annotation) => !saved.includes(annotation.id)));
    setSaving(false);
    setMessage(saved.length === pending.length ? "Marcações salvas no histórico." : "Algumas marcações continuam locais; exporte o PDF ou tente salvar novamente.");
    router.refresh();
  };

  return <section className="panel admin-review">
    <div className="admin-review-heading"><div><div className="eyebrow">Exclusivo do administrador</div><h2>Revisão de avaliações</h2><p className="panel-subtitle">Últimas oito abordagens concluídas, com recurso por fala e revisão manual.</p></div><ExportSessionPdf title={selected.title} difficulty={selected.difficulty} transcript={selected.transcript} evaluation={selected.evaluation} review={{ annotations, generalNote: selected.generalNote, appeals: selected.appeals }} /></div>
    <div className="review-session-list" role="list" aria-label="Últimas abordagens">{sessions.map((session) => <button type="button" role="listitem" key={session.id} className={session.id === selected.id ? "review-session-active" : "review-session"} onClick={() => { setSelectedId(session.id); setSelections([]); setMessage(null); }}><strong>{session.studentName}</strong><span>{session.evaluation.finalScore.toFixed(1)} / 10 · {time(session.completedAt)}</span>{session.appeals.some((appeal) => appeal.status === "PENDENTE") && <small>Recurso pendente</small>}</button>)}</div>
    <section className="review-case"><h3>{selected.title}</h3><p><strong>{selected.studentName}</strong> · {selected.difficulty} · {time(selected.completedAt)} · nota atual <strong>{selected.evaluation.finalScore.toFixed(1)} / 10</strong></p><div className="review-actions"><form action={previewAppealRecalculation}><input type="hidden" name="sessionId" value={selected.id}/><button type="submit" disabled={pending.length > 0}>Calcular prévia dos recursos</button></form><form action={recalculateEvaluation}><input type="hidden" name="sessionId" value={selected.id}/><button type="submit" disabled={pending.length > 0}>Aplicar nota recalculada</button></form><form action={sendRecalculatedEvaluationEmail}><input type="hidden" name="sessionId" value={selected.id}/><button type="submit">Enviar nova nota por e-mail</button></form></div>{pending.length > 0 && <p className="panel-subtitle">Salve as marcações pendentes antes de calcular ou aplicar a nota.</p>}</section>
    {selected.appeals.map((appeal) => <section className="appeal-admin" key={appeal.id}><h3>Recurso de nota · {appeal.status.toLowerCase()}</h3><p className="panel-subtitle">Enviado em {time(appeal.createdAt)} · nota original {appeal.previousScore.toFixed(1)} / 10{appeal.recalculatedScore === null ? "" : ` · prévia ${appeal.recalculatedScore.toFixed(1)} / 10`}.</p><ul>{appeal.items.map((item) => <li key={item.id}><span className="annotation-badge" style={{ backgroundColor: annotationMeta[item.annotationType].color }}>{annotationMeta[item.annotationType].label}</span><p><q>{item.selectedText}</q></p><form action={decideEvaluationAppealItem}><input type="hidden" name="appealId" value={appeal.id}/><input type="hidden" name="appealItemId" value={item.id}/><select name="decision" defaultValue={item.decision}><option value="PENDENTE" disabled>Pendente</option><option value="ACEITO">Aceitar item</option><option value="REJEITADO">Rejeitar item</option></select><button type="submit">Salvar decisão</button></form></li>)}</ul></section>)}
    <details className="review-system-report"><summary>Relatório gerado pelo sistema</summary><ul>{selected.evaluation.calculation.itens?.map((item) => <li key={item.titulo}><strong>{item.titulo}</strong>: {item.ajuste >= 0 ? "+" : ""}{item.ajuste.toFixed(1)} — {item.estado}. {item.evidencia}</li>)}</ul><h3>Acertos</h3><ul>{selected.evaluation.calculation.acertos?.map((item) => <li key={item}>{item}</li>)}</ul><h3>Ajustes</h3><ul>{selected.evaluation.calculation.melhorias?.map((item) => <li key={item}>{item}</li>)}</ul></details>
    <section className="review-workspace"><div className="review-transcript-column"><h3>Transcrição para revisão</h3><p className="panel-subtitle">Clique em ⌁ para selecionar uma ou várias falas e aplique as ferramentas pela barra fixa.</p><div className="review-transcript">{selected.transcript.map((turn) => { const marks = byTurn.get(turn.id) ?? []; const primary = marks[0] && annotationMeta[marks[0].annotationType]; return <article className={`turn turn-${turn.speaker.toLowerCase()} review-turn${selectedTurn(turn.id) ? " review-turn-selected" : ""}`} key={turn.id} style={primary ? { backgroundColor: primary.color } : undefined}><div className="review-turn-head"><strong>{labels[turn.speaker]}</strong><button type="button" className="review-select-turn" aria-label={`Alternar seleção da fala de ${labels[turn.speaker]}`} aria-pressed={selectedTurn(turn.id)} onClick={() => { toggleTurn(turn); setMessage(null); }}>⌁</button></div><p>{turn.content}</p>{marks.length > 0 && <div className="review-turn-labels">{marks.map((mark) => <span key={mark.id} title={annotationMeta[mark.annotationType].description}>{annotationMeta[mark.annotationType].label}</span>)}</div>}</article>; })}</div></div><aside className="review-tool-sidebar"><div className="review-tool-sidebar-inner"><h3>Ferramentas</h3><div className="review-selection-actions">{selections.length > 0 ? <p className="review-selection">{selections.length} fala(s) selecionada(s).</p> : <p className="panel-subtitle">Selecione uma ou mais falas.</p>}{selections.length > 0 && <button type="button" onClick={() => setSelections([])}>Limpar seleção</button>}</div><label>Observação opcional<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1500} disabled={selections.length === 0} placeholder="Explique a marcação, se necessário."/></label><div className="review-tool-buttons">{annotationTypes.map((type) => <button type="button" key={type} className="review-tool-button" style={{ borderColor: annotationMeta[type].color }} disabled={selections.length === 0} onMouseDown={(event) => event.preventDefault()} onClick={() => applyTool(type)}><i style={{ backgroundColor: annotationMeta[type].color }}/><span>{annotationMeta[type].label}</span><small>{annotationMeta[type].description}</small></button>)}</div>{pending.length > 0 && <button type="button" onClick={() => void saveDrafts()} disabled={saving}>{saving ? "Salvando marcações..." : `Salvar ${pending.length} marcação(ões) pendente(s)`}</button>}{message && <p className="review-status" role="status">{message}</p>}</div></aside></section>
    {annotations.length > 0 && <section className="saved-annotations"><h3>Marcações salvas e pendentes</h3><ul>{annotations.map((annotation) => <li key={annotation.id}><span className="annotation-badge" style={{ backgroundColor: annotationMeta[annotation.annotationType].color }}>{annotationMeta[annotation.annotationType].label}</span><q>{annotation.selectedText}</q>{annotation.note && <p>{annotation.note}</p>}{annotation.id.startsWith("draft-") ? <button type="button" onClick={() => setDrafts((current) => current.filter((entry) => entry.id !== annotation.id))}>Remover pendente</button> : <form action={deleteEvaluationAnnotation}><input type="hidden" name="sessionId" value={selected.id}/><input type="hidden" name="annotationId" value={annotation.id}/><button type="submit">Remover</button></form>}</li>)}</ul></section>}
    <section className="review-general-note"><h3>Observação geral da revisão</h3><form action={saveEvaluationReviewNote}><input type="hidden" name="sessionId" value={selected.id}/><textarea name="note" defaultValue={selected.generalNote ?? ""} required maxLength={3000} placeholder="Registre a orientação geral para esta avaliação."/><button type="submit">Salvar observação geral</button></form></section>
  </section>;
}
