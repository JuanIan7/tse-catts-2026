import "server-only";
import OpenAI from "openai";
import rubric from "./barema.v0.3.json";
import { calculateEvaluation, type ErrorSubmission, type EvaluationSubmission, type ItemSubmission } from "./scoring";
import { toEvaluationSubmission, type DidacticState } from "./didactic-state";
import type { InternalCase, PublicBriefing } from "./session-case";

type Transcript = { speaker: string; content: string; delivery_status: string };
type FinalExtras = { acertos: string[]; melhorias: string[]; linha_evolucao: { fala: string; observacao: string }[] };

function appliedError(entry: ErrorSubmission) { return typeof entry === "boolean" ? entry : entry.aplicado === true; }

function validFinalItem(entry: unknown): { estado: string; evidencia: string } | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const value = entry as { estado?: unknown; evidencia?: unknown };
  if (typeof value.estado !== "string" || typeof value.evidencia !== "string" || !value.evidencia.trim()) return null;
  return { estado: value.estado, evidencia: value.evidencia.trim().slice(0, 500) };
}

function itemAdjustment(id: string, entry: ItemSubmission) {
  const state = typeof entry === "string" ? entry : entry.estado;
  const rule = rubric.itens.find((item) => item.id === id);
  if (!rule) return Number.NEGATIVE_INFINITY;
  const states = rule.estados as unknown as Record<string, number>;
  return states[state] ?? Number.NEGATIVE_INFINITY;
}

function mergeFinalItems(baseline: EvaluationSubmission["itens"], candidate: unknown): EvaluationSubmission["itens"] {
  const proposed = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate as Record<string, unknown> : {};
  return Object.fromEntries(rubric.itens.map((item) => {
    const recorded = baseline[item.id];
    const parsed = validFinalItem(proposed[item.id]);
    if (!parsed || itemAdjustment(item.id, parsed) <= itemAdjustment(item.id, recorded)) return [item.id, recorded];
    if (!(parsed.estado in item.estados)) return [item.id, recorded];
    return [item.id, parsed];
  }));
}

function fallback(state: DidacticState, internalCase: InternalCase, reason: string) {
  return {
    ...calculateEvaluation(toEvaluationSubmission(state)),
    ficha_caso: { fator_principal: internalCase.fator_principal, fatores_risco: internalCase.fatores_risco, fatores_protecao: internalCase.fatores_protecao, perfil: internalCase.perfil_tipo ?? "NÃO ESPECIFICADO" },
    acertos: [], melhorias: ["Não foi possível concluir a análise textual final; a pontuação usa apenas evidências registradas durante a sessão."],
    linha_evolucao: [], motivo_encerramento: reason,
  };
}

export async function evaluateCompletedTranscript(input: { state: DidacticState; internalCase: InternalCase; briefing: PublicBriefing; transcript: Transcript[]; partial: boolean; reason: string }) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return fallback(input.state, input.internalCase, input.reason);
  const allowed = Object.fromEntries(rubric.itens.map((item) => [item.id, Object.keys(item.estados)]));
  const baseline = toEvaluationSubmission(input.state);
  const visibleTranscript = input.transcript
    .filter((turn) => turn.delivery_status === "OUVIDO" || turn.speaker === "SISTEMA")
    .map((turn) => ({ speaker: turn.speaker, content: turn.content.slice(0, 1200) }));
  const prompt = [
    "Você é avaliador didático de uma simulação adulta fictícia. Avalie somente o que aparece literalmente na transcrição.",
    "Nunca infira aproximação física, silêncio presencial, contato visual, postura ou tom acústico. Use nao_observavel apenas nesses aspectos sem evidência textual direta.",
    "Critérios textuais: apresentação exige nome ou função vinculados a Bombeiros/CBMERJ; pausas exigem turno entregue sem interrupção; escuta, espaço e tom adequado exigem resposta coerente sem hostilidade, menosprezo ou interrupção registrada; perguntas sim/não dão parcial e perguntas simples mais exploratórias dão feito; paráfrase exige resumo seguido de pergunta; memória exige convite como imagine ou você consegue se lembrar ligado a fato revelado; maiêutica/indução exige alternativas positivas ou perguntas encadeadas; saída digna exige próximo passo seguro, concreto e voluntário; domínio exige três trocas recíprocas sem interrupção.",
    "FATORES — aplique estritamente com base na transcrição inteira. Fator de proteção é elemento positivo revelado pelo personagem (vínculo, pessoa que ajuda, filho ou familiar importante, trabalho valorizado, projeto, valor ou recurso). Pontue fatores_protecao como encontrou_explorou apenas se o aluno perguntou, retomou, resumiu ou explorou esse elemento. Fator de risco é problema negativo revelado (ruptura, violência, discriminação, conflito, isolamento, abuso, perda ou sofrimento). Pontue fatores_risco como encontrou_isolou apenas se o aluno o identificou ou explorou. Fator principal é o acontecimento mais recente e decisivo que precipitou a crise naquele momento — não um problema antigo genérico. Pontue fator_principal como encontrou_isolou apenas se o aluno captou ou explorou esse evento catalisador. A ficha do caso jamais vale ponto por si só. Para cada fator pontuado, a evidência deve citar a fala do personagem e a fala correspondente do aluno; sem ambas, mantenha nao_encontrou.",
    "Erros graves somente quando houver fala literal inequívoca. Não crie fatos nem instrua sobre autoagressão.",
    "Retorne JSON com itens, erros_graves, acertos (máx. 4), melhorias (máx. 4), linha_evolucao (máx. 14). Cada item precisa de estado permitido e evidencia curta.",
    `ESTADOS PERMITIDOS: ${JSON.stringify(allowed)}`,
    `BASE JÁ OBSERVADA: ${JSON.stringify(baseline)}`,
    `CASO REVELADO NO ENCERRAMENTO: ${JSON.stringify({ fator_principal: input.internalCase.fator_principal, fatores_risco: input.internalCase.fatores_risco, fatores_protecao: input.internalCase.fatores_protecao, vinculos: input.internalCase.vinculos, perfil: input.internalCase.perfil_tipo })}`,
    `BRIEFING: ${JSON.stringify(input.briefing)}`,
    `TRANSCRIÇÃO: ${JSON.stringify(visibleTranscript)}`,
  ].join("\n\n");
  try {
    const response = await new OpenAI({ apiKey: key }).responses.create({ model: "gpt-4o-mini", store: false, max_output_tokens: 2200, input: [{ role: "developer", content: prompt }, { role: "user", content: "Gere a avaliação final em JSON." }], text: { format: { type: "json_object" } } });
    const parsed = JSON.parse(response.output_text) as { itens?: EvaluationSubmission["itens"]; erros_graves?: EvaluationSubmission["erros_graves"]; acertos?: unknown; melhorias?: unknown; linha_evolucao?: unknown };
    const confirmedErrors = Object.fromEntries(Object.entries(baseline.erros_graves ?? {}).filter(([, entry]) => appliedError(entry)));
    // A análise final aprimora os itens, mas não cria deduções graves novas.
    // Elas exigem detecção objetiva registrada durante a conversa.
    const submission: EvaluationSubmission = { parcial: input.partial, itens: mergeFinalItems(baseline.itens, parsed.itens), erros_graves: confirmedErrors };
    const calculation = calculateEvaluation(submission);
    const extras: FinalExtras = {
      acertos: Array.isArray(parsed.acertos) ? parsed.acertos.filter((x): x is string => typeof x === "string").slice(0, 4) : [],
      melhorias: Array.isArray(parsed.melhorias) ? parsed.melhorias.filter((x): x is string => typeof x === "string").slice(0, 4) : [],
      linha_evolucao: Array.isArray(parsed.linha_evolucao) ? parsed.linha_evolucao.filter((x): x is { fala: string; observacao: string } => Boolean(x && typeof x === "object" && typeof (x as { fala?: unknown }).fala === "string" && typeof (x as { observacao?: unknown }).observacao === "string")).slice(0, 14) : [],
    };
    return { ...calculation, ficha_caso: { fator_principal: input.internalCase.fator_principal, fatores_risco: input.internalCase.fatores_risco, fatores_protecao: input.internalCase.fatores_protecao, perfil: input.internalCase.perfil_tipo ?? "NÃO ESPECIFICADO" }, ...extras, motivo_encerramento: input.reason };
  } catch {
    return fallback(input.state, input.internalCase, input.reason);
  }
}
