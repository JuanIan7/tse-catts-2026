export const annotationTypes = [
  "PARAFRASE",
  "MEMORIA_LINKADA",
  "MAIEUTICA_TED",
  "SAIDA_DIGNA",
  "DOMINOU_DIALOGO",
  "CONDUZIU_SOLUCAO",
  "PERGUNTA_SIMPLES",
  "PERGUNTA_COMPLEXA",
  "FATOR_PROTECAO",
  "FATOR_RISCO",
  "FATOR_PRINCIPAL",
  "OBSERVACAO",
] as const;

export type AnnotationType = (typeof annotationTypes)[number];

export type ReviewAnnotation = {
  id: string;
  sessionId: string;
  transcriptId: string;
  annotationType: AnnotationType;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  note: string | null;
};

export const annotationMeta: Record<AnnotationType, { label: string; description: string; color: string }> = {
  PARAFRASE: { label: "Paráfrase resumida", description: "Resume informações já ditas e confirma o entendimento.", color: "#b9e0d0" },
  MEMORIA_LINKADA: { label: "Memória linkada", description: "Evoca uma lembrança positiva do passado ou futuro.", color: "#bcd8f5" },
  MAIEUTICA_TED: { label: "Maiêutica / TED", description: "Leva à reflexão ou oferece alternativas seguras.", color: "#dbc8f1" },
  SAIDA_DIGNA: { label: "Desistência / saída digna", description: "Oferece uma saída segura e atendimento.", color: "#f3dea0" },
  DOMINOU_DIALOGO: { label: "Dominou o diálogo", description: "Mantém coerência, escuta e condução sem erro de memória.", color: "#c9d8f0" },
  CONDUZIU_SOLUCAO: { label: "Conduziu solução", description: "Conduz a uma solução segura, verdadeira e realizável.", color: "#cce8d5" },
  PERGUNTA_SIMPLES: { label: "Pergunta simples", description: "Pergunta de resposta direta, como sim ou não.", color: "#faeda6" },
  PERGUNTA_COMPLEXA: { label: "Pergunta complexa", description: "Aprofunda uma informação já obtida.", color: "#acdce1" },
  FATOR_PROTECAO: { label: "Fator de proteção", description: "Vínculo, valor ou recurso positivo identificado.", color: "#bce5c6" },
  FATOR_RISCO: { label: "Fator de risco", description: "Problema, perda ou vulnerabilidade identificada.", color: "#f4c2bf" },
  FATOR_PRINCIPAL: { label: "Fator principal", description: "Evento recente que precipitou a tentativa.", color: "#f5cb9a" },
  OBSERVACAO: { label: "Observação", description: "Comentário administrativo sem classificação de ferramenta.", color: "#d8d9d5" },
};

export function isAnnotationType(value: string): value is AnnotationType {
  return annotationTypes.includes(value as AnnotationType);
}

export function selectedTextForRange(content: string, startOffset: number, endOffset: number) {
  const characters = Array.from(content);
  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset) || startOffset < 0 || endOffset <= startOffset || endOffset > characters.length) return null;
  const selected = characters.slice(startOffset, endOffset).join("");
  return selected.length > 0 && selected.length <= 500 ? selected : null;
}

/** PostgreSQL `char_length` and `substring` use Unicode character offsets. */
export function codePointOffsetAtUtf16Offset(content: string, utf16Offset: number) {
  return Array.from(content.slice(0, utf16Offset)).length;
}

export function utf16OffsetAtCodePointOffset(content: string, codePointOffset: number) {
  return Array.from(content).slice(0, codePointOffset).join("").length;
}

export function rangesOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && startB < endA;
}

export function needsReviewPdfPageBreak(currentY: number, requiredHeight: number, bottom: number) {
  return currentY + requiredHeight > bottom;
}
