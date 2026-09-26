import rubric from "./barema.v0.3.json";

type RubricItem = (typeof rubric.itens)[number];
type ErrorRule = (typeof rubric.erros_graves)[number];

export type ItemSubmission = { estado: string; evidencia: string; ajuste?: number } | string;
export type ErrorSubmission = { aplicado: boolean; evidencia: string } | boolean;

export type EvaluationSubmission = {
  parcial?: boolean;
  itens: Record<string, ItemSubmission>;
  erros_graves?: Record<string, ErrorSubmission>;
};

function itemEntry(entry: ItemSubmission): { estado: string; evidencia: string; ajuste?: number } {
  if (typeof entry === "string") return { estado: entry, evidencia: "" };
  if (typeof entry.estado !== "string" || typeof entry.evidencia !== "string" || (entry.ajuste !== undefined && (!Number.isFinite(entry.ajuste) || entry.ajuste < 0))) {
    throw new Error("Cada item precisa de estado textual e evidência textual.");
  }
  return { estado: entry.estado, evidencia: entry.evidencia.trim(), ajuste: entry.ajuste };
}

function errorEntry(entry: ErrorSubmission | undefined): { aplicado: boolean; evidencia: string } {
  if (entry === undefined) return { aplicado: false, evidencia: "" };
  if (typeof entry === "boolean") return { aplicado: entry, evidencia: "" };
  if (typeof entry.aplicado !== "boolean" || typeof entry.evidencia !== "string") {
    throw new Error("Erro grave precisa de aplicado booleano e evidência textual.");
  }
  return { aplicado: entry.aplicado, evidencia: entry.evidencia.trim() };
}

function oneDecimal(value: number) {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

export function calculateEvaluation(evaluation: EvaluationSubmission) {
  const expectedIds = rubric.itens.map((item) => item.id);
  const missing = expectedIds.filter((id) => !(id in evaluation.itens));
  const extra = Object.keys(evaluation.itens).filter((id) => !expectedIds.includes(id));
  if (missing.length) throw new Error(`Itens ausentes: ${missing.join(", ")}`);
  if (extra.length) throw new Error(`Itens desconhecidos: ${extra.sort().join(", ")}`);

  let itemTotal = 0;
  let coverage = 0;
  const itens = rubric.itens.map((item: RubricItem) => {
    const { estado, evidencia, ajuste: submittedAdjustment } = itemEntry(evaluation.itens[item.id]);
    const stateAdjustment = item.estados[estado as keyof typeof item.estados];
    if (stateAdjustment === undefined) {
      throw new Error(`Estado inválido em ${item.id}: ${estado}.`);
    }
    const supportsFraction = item.id === "fatores_protecao" || item.id === "fatores_risco";
    const adjustment = submittedAdjustment === undefined ? stateAdjustment : submittedAdjustment;
    if (submittedAdjustment !== undefined && (!supportsFraction || submittedAdjustment > stateAdjustment)) {
      throw new Error(`Ajuste proporcional inválido em ${item.id}.`);
    }
    if (!evidencia) throw new Error(`O item ${item.id} precisa de evidência ou justificativa de observabilidade.`);
    itemTotal += adjustment;
    if (estado !== rubric.cobertura.estado_excluido) coverage += 1;
    return { id: item.id, titulo: item.titulo, estado, ajuste: adjustment, evidencia };
  });

  const submittedErrors = evaluation.erros_graves ?? {};
  const knownErrors = rubric.erros_graves.map((error) => error.id);
  const unknownErrors = Object.keys(submittedErrors).filter((id) => !knownErrors.includes(id));
  if (unknownErrors.length) throw new Error(`Erros graves desconhecidos: ${unknownErrors.sort().join(", ")}`);

  let errorTotal = 0;
  const erros_graves = rubric.erros_graves.map((error: ErrorRule) => {
    const { aplicado, evidencia } = errorEntry(submittedErrors[error.id]);
    if (aplicado && !evidencia) throw new Error(`Erro grave ${error.id} foi aplicado sem evidência.`);
    const ajuste = aplicado ? error.deducao : 0;
    errorTotal += ajuste;
    return { id: error.id, titulo: error.titulo, aplicado, ajuste, evidencia };
  });

  const notaBase = rubric.meta.nota_base;
  const notaBruta = notaBase + itemTotal + errorTotal;
  const notaFinal = oneDecimal(Math.min(Math.max(notaBruta, rubric.meta.nota_minima), rubric.meta.nota_maxima));

  return {
    rotulo: rubric.meta.rotulo_obrigatorio,
    parcial: Boolean(evaluation.parcial),
    nota_base: notaBase,
    ajustes_itens: itemTotal,
    deducoes_erros_graves: errorTotal,
    nota_bruta: notaBruta,
    nota_final: notaFinal,
    cobertura: {
      avaliados: coverage,
      total: rubric.cobertura.total_de_itens,
      percentual: oneDecimal((coverage * 100) / rubric.cobertura.total_de_itens),
    },
    aviso_parcial: evaluation.parcial ? rubric.cobertura.aviso_parcial : null,
    itens,
    erros_graves,
  };
}

export function testSubmission(selection: "best" | "worst" | "not_observable"): EvaluationSubmission {
  return {
    parcial: selection === "not_observable",
    itens: Object.fromEntries(rubric.itens.map((item) => {
      const states = Object.entries(item.estados);
      const state = selection === "not_observable"
        ? "nao_observavel"
        : states.reduce((chosen, current) => selection === "best"
          ? (current[1] > chosen[1] ? current : chosen)
          : (current[1] < chosen[1] ? current : chosen))[0];
      return [item.id, { estado: state, evidencia: "teste" }];
    })),
  };
}
