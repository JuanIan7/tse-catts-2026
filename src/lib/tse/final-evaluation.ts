import "server-only";
import OpenAI from "openai";
import rubric from "./barema.v0.3.json";
import { calculateEvaluation, type EvaluationSubmission } from "./scoring";
import { toEvaluationSubmission, type DidacticState } from "./didactic-state";
import type { InternalCase, PublicBriefing } from "./session-case";

type Transcript = { speaker: string; content: string; delivery_status: string };
type FinalExtras = { acertos: string[]; melhorias: string[]; linha_evolucao: { fala: string; observacao: string }[] };

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
  const visibleTranscript = input.transcript.filter((turn) => turn.delivery_status === "OUVIDO" || turn.speaker === "SISTEMA").slice(-80).map((turn) => ({ speaker: turn.speaker, content: turn.content.slice(0, 700) }));
  const prompt = [
    "Você é avaliador didático de uma simulação adulta fictícia. Avalie somente o que aparece literalmente na transcrição.",
    "Nunca infira aproximação física, silêncio presencial, contato visual, postura ou tom acústico. Para esses, use nao_observavel quando não houver evidência textual direta.",
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
    const submission: EvaluationSubmission = { parcial: input.partial, itens: parsed.itens ?? baseline.itens, erros_graves: parsed.erros_graves ?? baseline.erros_graves };
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
