import rubric from "./barema.v0.3.json";
import { calculateEvaluation, type EvaluationSubmission } from "./scoring";

type StoredItem = { estado: string; evidencias: string[] };
type StoredError = { aplicado: boolean; evidencias: string[] };
export type DidacticSignal = { item_id: string; estado: string; evidencia: string };
export type DidacticErrorSignal = { erro_id: string; evidencia: string };
export type DidacticState = {
  version: 1;
  revision: number;
  turnos: number;
  rapport: number;
  categorias_reveladas: { risco: number; protecao: number; vinculo: number };
  interrupcoes: number;
  saida_digna_aceita: boolean;
  itens: Record<string, StoredItem>;
  erros_graves: Record<string, StoredError>;
};

const itemById = new Map(rubric.itens.map((item) => [item.id, item]));
const errorById = new Map(rubric.erros_graves.map((error) => [error.id, error]));
// Itens de presença corporal ou de qualidade acústica permanecem não observáveis por texto/transcrição.
const dialogueObservableItems = new Set([
  "apresentacao_pessoal", "espaco_para_desabafo", "perguntas_simples_complexas", "parafrase_resumida", "memoria_linkada", "maieutica_ou_teia", "desistencia_ou_saida_digna", "dominou_dialogo", "conduziu_solucao", "fatores_protecao", "fatores_risco", "fator_principal",
]);

function clamp(value: number, minimum: number, maximum: number) { return Math.max(minimum, Math.min(maximum, value)); }
function cleanEvidence(value: string) { return value.trim().replace(/\s+/g, " ").slice(0, 500); }
function knownItem(id: string, state: string) { const item = itemById.get(id); return Boolean(item && Object.hasOwn(item.estados, state)); }

export function createDidacticState(): DidacticState {
  return { version: 1, revision: 0, turnos: 0, rapport: 0, categorias_reveladas: { risco: 0, protecao: 0, vinculo: 0 }, interrupcoes: 0, saida_digna_aceita: false, itens: {}, erros_graves: {} };
}

export function readDidacticState(raw: unknown): DidacticState {
  const fallback = createDidacticState();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const value = raw as Record<string, unknown>;
  const categories = value.categorias_reveladas as Record<string, unknown> | undefined;
  const rawItems = value.itens as Record<string, unknown> | undefined;
  const rawErrors = value.erros_graves as Record<string, unknown> | undefined;
  const itens: Record<string, StoredItem> = {};
  const erros_graves: Record<string, StoredError> = {};
  for (const [id, entry] of Object.entries(rawItems ?? {})) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const item = entry as Record<string, unknown>;
    const estado = typeof item.estado === "string" ? item.estado : "";
    if (!knownItem(id, estado)) continue;
    const evidencias = Array.isArray(item.evidencias) ? item.evidencias.filter((e): e is string => typeof e === "string").map(cleanEvidence).filter(Boolean).slice(-3) : [];
    itens[id] = { estado, evidencias };
  }
  for (const [id, entry] of Object.entries(rawErrors ?? {})) {
    if (!errorById.has(id) || !entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const error = entry as Record<string, unknown>;
    const evidencias = Array.isArray(error.evidencias) ? error.evidencias.filter((e): e is string => typeof e === "string").map(cleanEvidence).filter(Boolean).slice(-3) : [];
    erros_graves[id] = { aplicado: Boolean(error.aplicado), evidencias };
  }
  return {
    version: 1,
    revision: typeof value.revision === "number" && Number.isInteger(value.revision) && value.revision >= 0 ? value.revision : 0,
    turnos: typeof value.turnos === "number" ? clamp(Math.floor(value.turnos), 0, 10000) : 0,
    rapport: typeof value.rapport === "number" ? clamp(Math.round(value.rapport), -3, 5) : 0,
    categorias_reveladas: {
      risco: typeof categories?.risco === "number" ? clamp(Math.floor(categories.risco), 0, 3) : 0,
      protecao: typeof categories?.protecao === "number" ? clamp(Math.floor(categories.protecao), 0, 3) : 0,
      vinculo: typeof categories?.vinculo === "number" ? clamp(Math.floor(categories.vinculo), 0, 3) : 0,
    },
    interrupcoes: typeof value.interrupcoes === "number" ? clamp(Math.floor(value.interrupcoes), 0, 20) : 0,
    saida_digna_aceita: value.saida_digna_aceita === true,
    itens,
    erros_graves,
  };
}

function chooseItemState(current: string | undefined, next: string) {
  if (!current || current === "nao_observavel") return next;
  if (next === "nao_observavel") return current;
  if (next === "feito" || next === "adequado" || next === "encontrou_explorou" || next === "encontrou_isolou") return next;
  return current;
}

export function applyDidacticSignals(current: DidacticState, input: { rapport_delta: number; categorias_reveladas: string[]; evidencias: DidacticSignal[]; erros_graves: DidacticErrorSignal[]; acceptsExit: boolean }) {
  const state = readDidacticState(current);
  state.turnos = clamp(state.turnos + 1, 0, 10000);
  state.rapport = clamp(state.rapport + clamp(Math.round(input.rapport_delta), -1, 1), -3, 5);
  for (const category of input.categorias_reveladas) {
    if (category === "RISCO") state.categorias_reveladas.risco = clamp(state.categorias_reveladas.risco + 1, 0, 3);
    if (category === "PROTECAO") state.categorias_reveladas.protecao = clamp(state.categorias_reveladas.protecao + 1, 0, 3);
    if (category === "VINCULO") state.categorias_reveladas.vinculo = clamp(state.categorias_reveladas.vinculo + 1, 0, 3);
  }
  for (const signal of input.evidencias.slice(0, 5)) {
    if (!dialogueObservableItems.has(signal.item_id) || !knownItem(signal.item_id, signal.estado)) continue;
    const evidence = cleanEvidence(signal.evidencia);
    if (!evidence) continue;
    const existing = state.itens[signal.item_id];
    state.itens[signal.item_id] = { estado: chooseItemState(existing?.estado, signal.estado), evidencias: [...(existing?.evidencias ?? []), evidence].slice(-3) };
  }
  for (const signal of input.erros_graves.slice(0, 2)) {
    if (!errorById.has(signal.erro_id)) continue;
    const evidence = cleanEvidence(signal.evidencia);
    if (!evidence) continue;
    const existing = state.erros_graves[signal.erro_id];
    state.erros_graves[signal.erro_id] = { aplicado: true, evidencias: [...(existing?.evidencias ?? []), evidence].slice(-3) };
  }
  state.saida_digna_aceita ||= input.acceptsExit;
  return state;
}

export function recordInterruption(current: DidacticState) { const state = readDidacticState(current); state.interrupcoes = clamp(state.interrupcoes + 1, 0, 20); return state; }
export function acceptDignifiedExit(current: DidacticState) { const state = readDidacticState(current); state.saida_digna_aceita = true; return state; }

export function toEvaluationSubmission(state: DidacticState): EvaluationSubmission {
  const safe = readDidacticState(state);
  return {
    parcial: !safe.saida_digna_aceita,
    itens: Object.fromEntries(rubric.itens.map((item) => {
      const entry = safe.itens[item.id];
      return [item.id, { estado: entry?.estado ?? "nao_observavel", evidencia: entry?.evidencias.join(" | ") || "Não observável nesta simulação de diálogo." }];
    })),
    erros_graves: Object.fromEntries(rubric.erros_graves.map((error) => {
      const entry = safe.erros_graves[error.id];
      return [error.id, { aplicado: entry?.aplicado ?? false, evidencia: entry?.evidencias.join(" | ") ?? "" }];
    })),
  };
}

export function calculateDidacticEvaluation(state: DidacticState) { return calculateEvaluation(toEvaluationSubmission(state)); }
