"use client";

import { useMemo, useState } from "react";
import { deleteEvaluationAnnotation, saveEvaluationAnnotation, saveEvaluationReviewNote } from "@/app/admin/actions";
import { annotationMeta, annotationTypes, codePointOffsetAtUtf16Offset, type AnnotationType, type ReviewAnnotation, utf16OffsetAtCodePointOffset } from "@/lib/admin/evaluation-review";
import { ExportSessionPdf } from "@/components/export-session-pdf";

type Turn = { id: string; speaker: "ALUNO" | "PERSONAGEM" | "NARRADOR" | "SISTEMA"; content: string };
type Evaluation = {
  result: string;
  finalScore: number;
  calculation: {
    ficha_caso?: { fator_principal: string; fatores_risco: string[]; fatores_protecao: string[] };
    itens?: { titulo: string; estado: string; ajuste: number; evidencia: string }[];
    acertos?: string[];
    melhorias?: string[];
    linha_evolucao?: { fala: string; observacao: string }[];
    motivo_encerramento?: string;
    nota_base?: number;
    ajustes_itens?: number;
    deducoes_erros_graves?: number;
    nota_bruta?: number;
  };
};
export type AdminReviewSession = { id: string; title: string; difficulty: string; completedAt: string; studentName: string; transcript: Turn[]; evaluation: Evaluation; annotations: ReviewAnnotation[]; generalNote: string | null };
type Selection = { transcriptId: string; startOffset: number; endOffset: number; selectedText: string };

const speakerLabel: Record<Turn["speaker"], string> = { ALUNO: "Você", PERSONAGEM: "Tentante", NARRADOR: "Narrador", SISTEMA: "Sistema" };

function selectionFor(element: HTMLElement): Selection | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (!element.contains(range.startContainer) || !element.contains(range.endContainer)) return null;
  const content = element.dataset.content ?? "";
  const startRange = range.cloneRange();
  startRange.selectNodeContents(element);
  startRange.setEnd(range.startContainer, range.startOffset);
  const endRange = range.cloneRange();
  endRange.selectNodeContents(element);
  endRange.setEnd(range.endContainer, range.endOffset);
  let startUtf16 = startRange.toString().length;
  let endUtf16 = endRange.toString().length;
  while (startUtf16 < endUtf16 && /\s/.test(content[startUtf16] ?? "")) startUtf16 += 1;
  while (endUtf16 > startUtf16 && /\s/.test(content[endUtf16 - 1] ?? "")) endUtf16 -= 1;
  const selectedText = content.slice(startUtf16, endUtf16);
  return selectedText.length > 0 && selectedText.length <= 500 ? { transcriptId: element.dataset.turnId ?? "", startOffset: codePointOffsetAtUtf16Offset(content, startUtf16), endOffset: codePointOffsetAtUtf16Offset(content, endUtf16), selectedText } : null;
}

function HighlightedText({ content, annotations }: { content: string; annotations: ReviewAnnotation[] }) {
  const sorted = [...annotations].sort((a, b) => a.startOffset - b.startOffset);
  return <>{sorted.map((annotation, index) => {
    const previousEnd = utf16OffsetAtCodePointOffset(content, sorted[index - 1]?.endOffset ?? 0);
    const startOffset = utf16OffsetAtCodePointOffset(content, annotation.startOffset);
    const endOffset = utf16OffsetAtCodePointOffset(content, annotation.endOffset);
    const before = content.slice(previousEnd, startOffset);
    const marked = content.slice(startOffset, endOffset);
    const meta = annotationMeta[annotation.annotationType];
    return <span key={annotation.id}>{before}<mark className="review-highlight" style={{ backgroundColor: meta.color }} title={meta.description} aria-label={`${marked} — ${meta.label}`} data-label={meta.label}>{marked}</mark></span>;
  })}{content.slice(utf16OffsetAtCodePointOffset(content, sorted.at(-1)?.endOffset ?? 0))}</>;
}

export function AdminEvaluationReview({ sessions }: { sessions: AdminReviewSession[] }) {
  const [selectedId, setSelectedId] = useState(sessions[0]?.id ?? "");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [annotationType, setAnnotationType] = useState<AnnotationType>("PARAFRASE");
  const selected = sessions.find((session) => session.id === selectedId);
  const annotationsByTurn = useMemo(() => {
    const grouped = new Map<string, ReviewAnnotation[]>();
    for (const annotation of selected?.annotations ?? []) grouped.set(annotation.transcriptId, [...(grouped.get(annotation.transcriptId) ?? []), annotation]);
    return grouped;
  }, [selected]);

  if (!selected) return <section className="panel"><h2>Revisão de avaliações</h2><p className="panel-subtitle">Ainda não há relatórios concluídos para revisar.</p></section>;

  return <section className="panel admin-review">
    <div className="admin-review-heading"><div><div className="eyebrow">Exclusivo do administrador</div><h2>Revisão de avaliações</h2><p className="panel-subtitle">Últimos cinco relatórios concluídos. As marcações não alteram a nota do aluno.</p></div><ExportSessionPdf title={selected.title} difficulty={selected.difficulty} transcript={selected.transcript} evaluation={selected.evaluation} review={{ annotations: selected.annotations, generalNote: selected.generalNote }} /></div>
    <div className="review-session-list" role="list" aria-label="Relatórios recentes">{sessions.map((session) => <button type="button" role="listitem" key={session.id} className={session.id === selected.id ? "review-session-active" : "review-session"} onClick={() => { setSelectedId(session.id); setSelection(null); }}><strong>{session.studentName}</strong><span>{session.evaluation.finalScore.toFixed(1)} / 10 · {new Date(session.completedAt).toLocaleDateString("pt-BR")}</span></button>)}</div>
    <section className="review-case"><h3>{selected.title}</h3><p><strong>{selected.studentName}</strong> · {selected.difficulty} · nota automática: <strong>{selected.evaluation.finalScore.toFixed(1)} / 10</strong></p>{selected.evaluation.calculation.ficha_caso && <><p><strong>Fator principal previsto:</strong> {selected.evaluation.calculation.ficha_caso.fator_principal}</p><p><strong>Riscos previstos:</strong> {selected.evaluation.calculation.ficha_caso.fatores_risco.join("; ")}</p><p><strong>Proteções previstas:</strong> {selected.evaluation.calculation.ficha_caso.fatores_protecao.join("; ")}</p></>}</section>
    <details className="review-system-report"><summary>Relatório gerado pelo sistema</summary><ul>{selected.evaluation.calculation.itens?.map((item) => <li key={item.titulo}><strong>{item.titulo}</strong>: {item.ajuste >= 0 ? "+" : ""}{item.ajuste.toFixed(1)} — {item.estado}. {item.evidencia}</li>)}</ul><h3>Acertos</h3><ul>{selected.evaluation.calculation.acertos?.map((item) => <li key={item}>{item}</li>)}</ul><h3>Ajustes</h3><ul>{selected.evaluation.calculation.melhorias?.map((item) => <li key={item}>{item}</li>)}</ul></details>
    <div className="review-legend" aria-label="Legenda de marcações"><strong>Legenda</strong>{annotationTypes.map((type) => <span key={type}><i style={{ backgroundColor: annotationMeta[type].color }} />{annotationMeta[type].label}</span>)}</div>
    <section><h3>Transcrição para revisão</h3><p className="panel-subtitle">Selecione um trecho dentro de uma única fala. Em seguida, escolha a ferramenta e salve.</p><div className="review-transcript">{selected.transcript.map((turn) => <article className={`turn turn-${turn.speaker.toLowerCase()}`} key={turn.id}><strong>{speakerLabel[turn.speaker]}</strong><p data-turn-id={turn.id} data-content={turn.content} onMouseUp={(event) => setSelection(selectionFor(event.currentTarget))} onKeyUp={(event) => setSelection(selectionFor(event.currentTarget))}><HighlightedText content={turn.content} annotations={annotationsByTurn.get(turn.id) ?? []} /></p></article>)}</div></section>
    <section className="review-annotation-form"><h3>Nova marcação</h3>{selection ? <><p className="notice">Trecho selecionado: “{selection.selectedText}”</p><div className="annotation-type-buttons">{annotationTypes.map((type) => <button type="button" key={type} className={annotationType === type ? "annotation-type-active" : "annotation-type"} style={{ borderColor: annotationMeta[type].color }} title={annotationMeta[type].description} onMouseDown={(event) => event.preventDefault()} onClick={() => setAnnotationType(type)}>{annotationMeta[type].label}</button>)}</div><p className="panel-subtitle"><strong>{annotationMeta[annotationType].label}:</strong> {annotationMeta[annotationType].description}</p><form action={saveEvaluationAnnotation}><input type="hidden" name="sessionId" value={selected.id}/><input type="hidden" name="transcriptId" value={selection.transcriptId}/><input type="hidden" name="startOffset" value={selection.startOffset}/><input type="hidden" name="endOffset" value={selection.endOffset}/><input type="hidden" name="selectedText" value={selection.selectedText}/><input type="hidden" name="annotationType" value={annotationType}/><label>Observação opcional<textarea name="note" maxLength={1500} placeholder="Explique por que este trecho deveria ser considerado." /></label><button type="submit">Salvar marcação</button></form></> : <p className="notice">Nenhum trecho selecionado. Selecione palavras de uma fala para classificá-las.</p>}</section>
    {selected.annotations.length > 0 && <section className="saved-annotations"><h3>Marcações salvas</h3><ul>{selected.annotations.map((annotation) => <li key={annotation.id}><span className="annotation-badge" style={{ backgroundColor: annotationMeta[annotation.annotationType].color }}>{annotationMeta[annotation.annotationType].label}</span><q>{annotation.selectedText}</q>{annotation.note && <p>{annotation.note}</p>}<form action={deleteEvaluationAnnotation}><input type="hidden" name="sessionId" value={selected.id}/><input type="hidden" name="annotationId" value={annotation.id}/><button type="submit">Remover</button></form></li>)}</ul></section>}
    <section className="review-general-note"><h3>Observação geral da revisão</h3><form action={saveEvaluationReviewNote}><input type="hidden" name="sessionId" value={selected.id}/><textarea name="note" defaultValue={selected.generalNote ?? ""} required maxLength={3000} placeholder="Registre a orientação geral para esta avaliação."/><button type="submit">Salvar observação geral</button></form></section>
  </section>;
}
