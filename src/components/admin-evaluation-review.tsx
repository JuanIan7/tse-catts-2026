"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteEvaluationAnnotation, recalculateEvaluation, saveEvaluationAnnotation, saveEvaluationReviewNote, sendRecalculatedEvaluationEmail } from "@/app/admin/actions";
import { annotationMeta, annotationTypes, type AnnotationType, type ReviewAnnotation } from "@/lib/admin/evaluation-review";
import { ExportSessionPdf } from "@/components/export-session-pdf";

type Turn = { id: string; speaker: "ALUNO" | "PERSONAGEM" | "NARRADOR" | "SISTEMA"; content: string };
type Evaluation = { result: string; finalScore: number; calculation: { ficha_caso?: { fator_principal: string; fatores_risco: string[]; fatores_protecao: string[] }; itens?: { titulo: string; estado: string; ajuste: number; evidencia: string }[]; acertos?: string[]; melhorias?: string[]; nota_base?: number; ajustes_itens?: number; deducoes_erros_graves?: number; nota_bruta?: number } };
export type AdminReviewSession = { id: string; title: string; difficulty: string; completedAt: string; studentName: string; transcript: Turn[]; evaluation: Evaluation; annotations: ReviewAnnotation[]; generalNote: string | null; reviewRequests: { tools: string[]; createdAt: string }[] };
type Selection = { transcriptId: string; startOffset: number; endOffset: number; selectedText: string };

const speakerLabel: Record<Turn["speaker"], string> = { ALUNO: "Você", PERSONAGEM: "Tentante", NARRADOR: "Narrador", SISTEMA: "Sistema" };
const selectionForTurn = (turn: Turn): Selection => ({ transcriptId: turn.id, startOffset: 0, endOffset: Array.from(turn.content).length, selectedText: turn.content });

export function AdminEvaluationReview({ sessions }: { sessions: AdminReviewSession[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(sessions[0]?.id ?? "");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [annotationNote, setAnnotationNote] = useState("");
  const [draftAnnotations, setDraftAnnotations] = useState<ReviewAnnotation[]>([]);
  const [savingAnnotations, setSavingAnnotations] = useState(false);
  const [annotationMessage, setAnnotationMessage] = useState<string | null>(null);
  const draftSequence = useRef(0);
  const selected = sessions.find((session) => session.id === selectedId);
  const visibleAnnotations = useMemo(() => [...(selected?.annotations ?? []), ...draftAnnotations.filter((annotation) => annotation.sessionId === selected?.id)], [draftAnnotations, selected]);
  const annotationsByTurn = useMemo(() => {
    const grouped = new Map<string, ReviewAnnotation[]>();
    for (const annotation of visibleAnnotations) grouped.set(annotation.transcriptId, [...(grouped.get(annotation.transcriptId) ?? []), annotation]);
    return grouped;
  }, [visibleAnnotations]);
  const pendingAnnotations = draftAnnotations.filter((annotation) => annotation.sessionId === selected?.id);
  if (!selected) return <section className="panel"><h2>Revisão de avaliações</h2><p className="panel-subtitle">Ainda não há relatórios concluídos para revisar.</p></section>;

  const applyAnnotation = (annotationType: AnnotationType) => {
    if (!selection) return;
    const draftId = `draft-${draftSequence.current++}`;
    const draft: ReviewAnnotation = { id: draftId, sessionId: selected.id, transcriptId: selection.transcriptId, annotationType, startOffset: selection.startOffset, endOffset: selection.endOffset, selectedText: selection.selectedText, note: annotationNote.trim() || null };
    setDraftAnnotations((current) => [...current, draft]);
    setSelection(null); setAnnotationNote(""); setAnnotationMessage(`${annotationMeta[annotationType].label} aplicada e mantida localmente.`);
  };

  const savePendingAnnotations = async () => {
    if (pendingAnnotations.length === 0) return;
    setSavingAnnotations(true);
    const saved: string[] = [];
    for (const annotation of pendingAnnotations) {
      const formData = new FormData();
      for (const [key, value] of Object.entries({ sessionId: annotation.sessionId, transcriptId: annotation.transcriptId, startOffset: String(annotation.startOffset), endOffset: String(annotation.endOffset), selectedText: annotation.selectedText, annotationType: annotation.annotationType, note: annotation.note ?? "" })) formData.set(key, value);
      try { await saveEvaluationAnnotation(formData); saved.push(annotation.id); } catch { /* A marcação continua disponível para PDF e nova tentativa. */ }
    }
    setDraftAnnotations((current) => current.filter((annotation) => !saved.includes(annotation.id)));
    setSavingAnnotations(false);
    setAnnotationMessage(saved.length === pendingAnnotations.length ? "Marcações salvas no histórico." : "Algumas marcações continuam locais. Você pode exportar o PDF ou tentar salvar novamente.");
    router.refresh();
  };

  return <section className="panel admin-review">
    <div className="admin-review-heading"><div><div className="eyebrow">Exclusivo do administrador</div><h2>Revisão de avaliações</h2><p className="panel-subtitle">Últimos cinco relatórios concluídos. Salve as marcações e recalcule a nota quando necessário.</p></div><ExportSessionPdf title={selected.title} difficulty={selected.difficulty} transcript={selected.transcript} evaluation={selected.evaluation} review={{ annotations: visibleAnnotations, generalNote: selected.generalNote }} /></div>
    <div className="review-session-list" role="list" aria-label="Relatórios recentes">{sessions.map((session) => <button type="button" role="listitem" key={session.id} className={session.id === selected.id ? "review-session-active" : "review-session"} onClick={() => { setSelectedId(session.id); setSelection(null); setAnnotationMessage(null); }}><strong>{session.studentName}</strong><span>{session.evaluation.finalScore.toFixed(1)} / 10 · {new Date(session.completedAt).toLocaleDateString("pt-BR")}</span></button>)}</div>
    <section className="review-case"><h3>{selected.title}</h3><p><strong>{selected.studentName}</strong> · {selected.difficulty} · nota atual: <strong>{selected.evaluation.finalScore.toFixed(1)} / 10</strong></p>{selected.evaluation.calculation.ficha_caso && <><p><strong>Fator principal previsto:</strong> {selected.evaluation.calculation.ficha_caso.fator_principal}</p><p><strong>Riscos previstos:</strong> {selected.evaluation.calculation.ficha_caso.fatores_risco.join("; ")}</p><p><strong>Proteções previstas:</strong> {selected.evaluation.calculation.ficha_caso.fatores_protecao.join("; ")}</p></>}{selected.reviewRequests.length > 0 && <p className="notice"><strong>Apontamento do aluno:</strong> {selected.reviewRequests.flatMap((request) => request.tools).join(", ")}</p>}<div className="review-actions"><form action={recalculateEvaluation}><input type="hidden" name="sessionId" value={selected.id}/><button type="submit" disabled={pendingAnnotations.length > 0}>Recalcular nota</button></form><form action={async (formData) => { await sendRecalculatedEvaluationEmail(formData); }}><input type="hidden" name="sessionId" value={selected.id}/><button type="submit">Enviar nova nota por e-mail</button></form></div>{pendingAnnotations.length > 0 && <p className="panel-subtitle">Salve as marcações pendentes antes de recalcular a nota.</p>}</section>
    <details className="review-system-report"><summary>Relatório gerado pelo sistema</summary><ul>{selected.evaluation.calculation.itens?.map((item) => <li key={item.titulo}><strong>{item.titulo}</strong>: {item.ajuste >= 0 ? "+" : ""}{item.ajuste.toFixed(1)} — {item.estado}. {item.evidencia}</li>)}</ul><h3>Acertos</h3><ul>{selected.evaluation.calculation.acertos?.map((item) => <li key={item}>{item}</li>)}</ul><h3>Ajustes</h3><ul>{selected.evaluation.calculation.melhorias?.map((item) => <li key={item}>{item}</li>)}</ul></details>
    <section className="review-workspace"><div className="review-transcript-column"><h3>Transcrição para revisão</h3><p className="panel-subtitle">Clique em ⌁ para selecionar a fala inteira; depois escolha uma ferramenta na barra fixa.</p><div className="review-transcript">{selected.transcript.map((turn) => { const marks = annotationsByTurn.get(turn.id) ?? []; const primary = marks[0] && annotationMeta[marks[0].annotationType]; return <article className={`turn turn-${turn.speaker.toLowerCase()} review-turn${selection?.transcriptId === turn.id ? " review-turn-selected" : ""}`} key={turn.id} style={primary ? { backgroundColor: primary.color } : undefined}><div className="review-turn-head"><strong>{speakerLabel[turn.speaker]}</strong><button type="button" className="review-select-turn" title="Selecionar esta fala inteira" aria-label={`Selecionar fala de ${speakerLabel[turn.speaker]}`} onClick={() => { setSelection(selectionForTurn(turn)); setAnnotationMessage(null); }}>⌁</button></div><p>{turn.content}</p>{marks.length > 0 && <div className="review-turn-labels">{marks.map((mark) => <span key={mark.id} title={annotationMeta[mark.annotationType].description}>{annotationMeta[mark.annotationType].label}</span>)}</div>}</article>; })}</div></div><aside className="review-tool-sidebar" aria-label="Ferramentas de marcação"><div className="review-tool-sidebar-inner"><h3>Ferramentas</h3>{selection ? <p className="review-selection">Fala inteira selecionada: “{selection.selectedText}”</p> : <p className="panel-subtitle">Clique no ícone ⌁ de uma fala para selecioná-la.</p>}<label>Observação opcional<textarea value={annotationNote} onChange={(event) => setAnnotationNote(event.target.value)} maxLength={1500} disabled={!selection} placeholder="Explique a marcação, se necessário." /></label><div className="review-tool-buttons">{annotationTypes.map((type) => <button type="button" key={type} className="review-tool-button" style={{ borderColor: annotationMeta[type].color }} disabled={!selection} title={annotationMeta[type].description} onMouseDown={(event) => event.preventDefault()} onClick={() => applyAnnotation(type)}><i style={{ backgroundColor: annotationMeta[type].color }} /><span>{annotationMeta[type].label}</span><small>{annotationMeta[type].description}</small></button>)}</div>{pendingAnnotations.length > 0 && <button type="button" onClick={() => void savePendingAnnotations()} disabled={savingAnnotations}>{savingAnnotations ? "Salvando marcações..." : `Salvar ${pendingAnnotations.length} marcação(ões) pendente(s)`}</button>}{annotationMessage && <p className="review-status" role="status">{annotationMessage}</p>}</div></aside></section>
    {visibleAnnotations.length > 0 && <section className="saved-annotations"><h3>Marcações salvas e pendentes</h3><ul>{visibleAnnotations.map((annotation) => <li key={annotation.id}><span className="annotation-badge" style={{ backgroundColor: annotationMeta[annotation.annotationType].color }}>{annotationMeta[annotation.annotationType].label}</span><q>{annotation.selectedText}</q>{annotation.note && <p>{annotation.note}</p>}{annotation.id.startsWith("draft-") ? <button type="button" onClick={() => setDraftAnnotations((current) => current.filter((entry) => entry.id !== annotation.id))}>Remover pendente</button> : <form action={deleteEvaluationAnnotation}><input type="hidden" name="sessionId" value={selected.id}/><input type="hidden" name="annotationId" value={annotation.id}/><button type="submit">Remover</button></form>}</li>)}</ul></section>}
    <section className="review-general-note"><h3>Observação geral da revisão</h3><form action={saveEvaluationReviewNote}><input type="hidden" name="sessionId" value={selected.id}/><textarea name="note" defaultValue={selected.generalNote ?? ""} required maxLength={3000} placeholder="Registre a orientação geral para esta avaliação."/><button type="submit">Salvar observação geral</button></form></section>
  </section>;
}
