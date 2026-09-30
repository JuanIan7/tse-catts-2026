import rubric from "../tse/barema.v0.3.json";
import { calculateEvaluation, type EvaluationSubmission, type ItemSubmission } from "../tse/scoring";
import type { ReviewAnnotation } from "./evaluation-review";

type StoredItem = { id: string; estado: string; evidencia: string; ajuste?: number };
type StoredCalculation = { itens?: StoredItem[]; erros_graves?: Record<string, { aplicado: boolean; evidencia: string }> | { id: string; aplicado: boolean; evidencia: string }[]; parcial?: boolean; [key: string]: unknown };

const itemForAnnotation: Partial<Record<ReviewAnnotation["annotationType"], string>> = {
  PARAFRASE: "parafrase_resumida",
  MEMORIA_LINKADA: "memoria_linkada",
  MAIEUTICA_TED: "maieutica_ou_teia",
  SAIDA_DIGNA: "desistencia_ou_saida_digna",
  FATOR_PROTECAO: "fatores_protecao",
  FATOR_RISCO: "fatores_risco",
  FATOR_PRINCIPAL: "fator_principal",
};

function stateFor(id: string, ajuste: number) {
  const rule = rubric.itens.find((item) => item.id === id);
  if (!rule) return "nao_feito";
  return Object.entries(rule.estados).find(([, value]) => value === ajuste)?.[0] ?? "feito";
}

function asSubmission(calculation: StoredCalculation): EvaluationSubmission {
  const byId = new Map((calculation.itens ?? []).map((item) => [item.id, item]));
  const itens = Object.fromEntries(rubric.itens.map((rule) => {
    const current = byId.get(rule.id);
    const fallbackState = "nao_feito" in rule.estados ? "nao_feito" : "nao_encontrou" in rule.estados ? "nao_encontrou" : "nao_observavel";
    // Apenas os fatores usam um ajuste proporcional informado manualmente.
    // Os demais itens têm o ajuste definido pelo barema a partir do estado.
    // Reaproveitar o ajuste salvo (por exemplo, 0,1 dos itens automáticos)
    // faz o validador rejeitar o recálculo.
    const acceptsManualAdjustment = rule.id === "fatores_protecao" || rule.id === "fatores_risco";
    return [rule.id, {
      estado: current?.estado ?? fallbackState,
      evidencia: current?.evidencia || "Sem evidência registrada.",
      ...(acceptsManualAdjustment && current?.ajuste !== undefined ? { ajuste: current.ajuste } : {}),
    } satisfies ItemSubmission];
  }));
  const sourceErrors = Array.isArray(calculation.erros_graves)
    ? Object.fromEntries(calculation.erros_graves.map((error) => [error.id, { aplicado: error.aplicado, evidencia: error.evidencia }]))
    : calculation.erros_graves ?? {};
  return { parcial: Boolean(calculation.parcial), itens, erros_graves: sourceErrors };
}

export function recalculateEvaluationFromAnnotations(calculation: StoredCalculation, annotations: ReviewAnnotation[]) {
  const submission = asSubmission(calculation);
  const markCount = (type: ReviewAnnotation["annotationType"]) => annotations.filter((annotation) => annotation.annotationType === type).length;
  const apply = (id: string, estado: string, evidencia: string, ajuste?: number) => {
    submission.itens[id] = { estado, evidencia, ...(ajuste === undefined ? {} : { ajuste }) };
  };

  if (markCount("PERGUNTA_SIMPLES") && markCount("PERGUNTA_COMPLEXA")) apply("perguntas_simples_complexas", "feito", "Perguntas simples e aprofundamento confirmados pela revisão administrativa.");
  else if (markCount("PERGUNTA_SIMPLES") || markCount("PERGUNTA_COMPLEXA")) apply("perguntas_simples_complexas", "parcial", "Pergunta confirmada pela revisão administrativa.");
  for (const [type, id] of Object.entries(itemForAnnotation) as [ReviewAnnotation["annotationType"], string][]) {
    if (!markCount(type)) continue;
    if (id === "fatores_protecao" || id === "fatores_risco") {
      const total = id === "fatores_protecao"
        ? ((calculation.ficha_caso as { fatores_protecao?: string[] } | undefined)?.fatores_protecao?.length ?? 1)
        : ((calculation.ficha_caso as { fatores_risco?: string[] } | undefined)?.fatores_risco?.length ?? 1);
      const ajuste = Math.min(1, markCount(type) / Math.max(total, 1));
      apply(id, id === "fatores_protecao" ? "encontrou_explorou" : "encontrou_isolou", `${markCount(type)} fator(es) confirmado(s) pela revisão administrativa.`, ajuste);
    } else {
      const target = id === "desistencia_ou_saida_digna" ? "feito" : stateFor(id, 1);
      apply(id, target, "Ferramenta confirmada pela revisão administrativa.");
    }
  }
  const hasDialogueTool = ["PARAFRASE", "MEMORIA_LINKADA", "MAIEUTICA_TED", "SAIDA_DIGNA"].some((type) => markCount(type as ReviewAnnotation["annotationType"]) > 0);
  if (hasDialogueTool && markCount("FATOR_PROTECAO") && markCount("FATOR_RISCO")) apply("dominou_dialogo", "feito", "Domínio confirmado pela revisão: diálogo, fator de proteção, fator de risco e ferramenta registrados.");
  const next = calculateEvaluation(submission);
  return { ...calculation, ...next, recalculada_manual: true };
}
