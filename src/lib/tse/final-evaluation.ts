import "server-only";
import OpenAI from "openai";
import rubric from "./barema.v0.3.json";
import { calculateEvaluation, type ErrorSubmission, type EvaluationSubmission, type ItemSubmission } from "./scoring";
import { toEvaluationSubmission, type DidacticState } from "./didactic-state";
import { detectDialogueTools, dialogueControlState, questionKinds } from "./dialogue-tools";
import type { InternalCase, PublicBriefing } from "./session-case";
import { analyzeTranscriptEvidence, factorItemsFromEvidence, hasAcceptedSafeExit, type TranscriptEvidence } from "./transcript-evidence";

type Transcript = { speaker: string; content: string; delivery_status: string };
type FinalExtras = { acertos: string[]; melhorias: string[]; linha_evolucao: { fala: string; observacao: string }[] };

function appliedError(entry: ErrorSubmission) { return typeof entry === "boolean" ? entry : entry.aplicado === true; }

function validFinalItem(entry: unknown): { estado: string; evidencia: string; ajuste?: number } | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const value = entry as { estado?: unknown; evidencia?: unknown; ajuste?: unknown };
  if (typeof value.estado !== "string" || typeof value.evidencia !== "string" || !value.evidencia.trim()) return null;
  if (value.ajuste !== undefined && (typeof value.ajuste !== "number" || !Number.isFinite(value.ajuste) || value.ajuste < 0)) return null;
  return { estado: value.estado, evidencia: value.evidencia.trim().slice(0, 500), ajuste: value.ajuste };
}

function itemAdjustment(id: string, entry: ItemSubmission) {
  const state = typeof entry === "string" ? entry : entry.estado;
  const rule = rubric.itens.find((item) => item.id === id);
  if (!rule) return Number.NEGATIVE_INFINITY;
  const states = rule.estados as unknown as Record<string, number>;
  const adjustment = typeof entry === "string" ? undefined : entry.ajuste;
  return adjustment ?? states[state] ?? Number.NEGATIVE_INFINITY;
}

function mergeFinalItems(baseline: EvaluationSubmission["itens"], candidate: unknown): EvaluationSubmission["itens"] {
  const proposed = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate as Record<string, unknown> : {};
  const factors = new Set(["fatores_protecao", "fatores_risco", "fator_principal"]);
  return Object.fromEntries(rubric.itens.map((item) => {
    const recorded = baseline[item.id];
    // A fração de fatores é comprovada pela ficha e pela transcrição. O modelo
    // pode explicar o resultado, mas não pode apagar nem inflar esse cálculo.
    if (factors.has(item.id)) return [item.id, recorded];
    const parsed = validFinalItem(proposed[item.id]);
    if (!parsed || itemAdjustment(item.id, parsed) <= itemAdjustment(item.id, recorded)) return [item.id, recorded];
    if (!(parsed.estado in item.estados)) return [item.id, recorded];
    return [item.id, parsed];
  }));
}

function deterministicToolItems(transcript: Transcript[], evidence: TranscriptEvidence, acceptedProtocolExit: boolean): Record<string, ItemSubmission> {
  const tools = evidence.tools ?? detectDialogueTools(transcript);
  const items: Record<string, ItemSubmission> = {
    ...(tools.parafrase ? { parafrase_resumida: { estado: "feito", evidencia: `Paráfrase resumida identificada: ${tools.parafrase}` } } : {}),
    ...(tools.memoria ? { memoria_linkada: { estado: "feito", evidencia: `Memória linkada identificada: ${tools.memoria}` } } : {}),
    ...(tools.teia ? { maieutica_ou_teia: { estado: "feito", evidencia: `Teia de indução identificada: ${tools.teia}` } } : {}),
    ...(acceptedProtocolExit && evidence.exit.offer ? { desistencia_ou_saida_digna: { estado: "feito", evidencia: `Oferta segura de ambulância/hospital identificada: ${evidence.exit.offer.content}` } } : {}),
    ...(acceptedProtocolExit && hasAcceptedSafeExit(evidence) ? { conduziu_solucao: { estado: "feito", evidencia: `Solução segura aceita pelo tentante: ${evidence.exit.acceptance?.content ?? "aceitação registrada"}` } } : {}),
  };
  const questions = questionKinds(transcript);
  if (questions.simple && questions.complex) items.perguntas_simples_complexas = { estado: "feito", evidencia: `Pergunta simples e aprofundamento identificados: ${questions.simple} / ${questions.complex}` };
  else if (questions.simple || questions.complex) items.perguntas_simples_complexas = { estado: "parcial", evidencia: `Pergunta ${questions.simple ? "simples" : "complexa"} identificada: ${questions.simple ?? questions.complex}` };
  return items;
}

function applyDialogueControl(items: EvaluationSubmission["itens"], transcript: Transcript[]) {
  const state = dialogueControlState(items, transcript);
  const evidence = state === "feito"
    ? "Diálogo sustentado com fator de proteção, fator de risco e ferramenta de linguagem reconhecidos, sem erro de memória detectado."
    : state === "parcial"
      ? "Um erro de repetição, esquecimento ou troca de informação foi identificado na conversa."
      : "Não houve os requisitos completos de domínio do diálogo ou foram identificados dois ou mais erros de memória.";
  return { ...items, dominou_dialogo: { estado: state, evidencia: evidence } };
}

function confirmedErrors(state: DidacticState) {
  return Object.fromEntries(Object.entries(toEvaluationSubmission(state).erros_graves ?? {}).filter(([, entry]) => appliedError(entry)));
}

function completedBaseline(state: DidacticState, internalCase: InternalCase, transcript: Transcript[], acceptedProtocolExit: boolean) {
  const baseline = toEvaluationSubmission(state);
  const evidence = analyzeTranscriptEvidence(internalCase, transcript);
  const deterministicFactors = factorItemsFromEvidence(internalCase, evidence);
  for (const id of ["fatores_protecao", "fatores_risco", "fator_principal"]) {
    const deterministic = deterministicFactors[id as keyof typeof deterministicFactors];
    if (deterministic) {
      baseline.itens[id] = deterministic;
      continue;
    }
    // Sinais válidos já registrados ao vivo continuam como piso. A análise
    // final não pode retirar um crédito somente porque a nova heurística não
    // encontrou a mesma formulação textual.
    if (itemAdjustment(id, baseline.itens[id]) > 0) continue;
    baseline.itens[id] = { estado: "nao_encontrou", evidencia: "Nenhuma evidência comprovada deste fator foi encontrada na transcrição." };
  }
  return { baseline, evidence, items: mergeFinalItems(baseline.itens, deterministicToolItems(transcript, evidence, acceptedProtocolExit)) };
}

function fallback(state: DidacticState, internalCase: InternalCase, transcript: Transcript[], partial: boolean, reason: string) {
  const { items } = completedBaseline(state, internalCase, transcript, !partial);
  const calculation = calculateEvaluation({ parcial: partial, itens: applyDialogueControl(items, transcript), erros_graves: confirmedErrors(state) });
  return {
    ...calculation,
    ficha_caso: { fator_principal: internalCase.fator_principal, fatores_risco: internalCase.fatores_risco, fatores_protecao: internalCase.fatores_protecao, perfil: internalCase.perfil_tipo ?? "NÃO ESPECIFICADO" },
    acertos: [], melhorias: ["Não foi possível concluir a análise textual final; a pontuação usa apenas evidências registradas durante a sessão."],
    linha_evolucao: [], motivo_encerramento: reason,
  };
}

export async function evaluateCompletedTranscript(input: { state: DidacticState; internalCase: InternalCase; briefing: PublicBriefing; transcript: Transcript[]; partial: boolean; reason: string }) {
  const key = process.env.OPENAI_API_KEY;
  const deliveredTranscript = input.transcript.filter((turn) => turn.delivery_status === "OUVIDO");
  const { baseline, items: deterministicItems } = completedBaseline(input.state, input.internalCase, deliveredTranscript, !input.partial);
  if (!key) return fallback(input.state, input.internalCase, deliveredTranscript, input.partial, input.reason);
  const allowed = Object.fromEntries(rubric.itens.map((item) => [item.id, Object.keys(item.estados)]));
  const visibleTranscript = input.transcript
    .filter((turn) => turn.delivery_status === "OUVIDO" || turn.speaker === "SISTEMA")
    .map((turn) => ({ speaker: turn.speaker, content: turn.content.slice(0, 1200) }));
  const prompt = [
    "Você é avaliador didático de uma simulação adulta fictícia. Avalie somente o que aparece literalmente na transcrição.",
    "Aproximação calma e silenciosa, respeito às pausas, espaço para desabafo, escuta e tom adequado recebem crédito protocolar automático. Só retire escuta/domínio se o aluno repetir, esquecer ou trocar fato já dito; só retire tom se houver grito textual inequívoco. Silêncio inicial exige evento de sistema; apresentação exige nome E Bombeiros/CBMERJ.",
    "Perguntas: uma simples de sim/não OU uma complexa vale parcial (0.5); ambas valem feito (1.0). Complexa aprofunda uma simples. Paráfrase exige resumo de fatos e pergunta. Memória linkada é convite a lembrança positiva passada ou futura. Maiêutica OU TED valem integralmente: perguntas encadeadas que conduzem a conclusão, ou duas alternativas positivas desejadas.",
    "Saída digna: convite simples a sair da cena, sem ambulância/cuidado especializado, vale parcial (0.5). Ambulância e atendimento médico especializado valem 1.0 somente quando a oferta é segura e plausível. Condução à solução vale 1.0 somente para solução legal, verdadeira e realizável, preferencialmente hospitalar; não há parcial. Domínio vale 0.3 se achou um risco, uma proteção e usou ferramenta sem erros de memória; 0.15 com exatamente um erro de memória; zero com dois ou mais.",
    "FATORES — a base já contém a fração determinística encontrada na transcrição. Não reduza, aumente ou invente fatores; use as evidências fornecidas para explicar a devolutiva. Fator revelado pelo personagem ou identificado pelo aluno é válido. Fator principal exige o gatilho recente que precipitou a crise.",
    "Erros graves somente quando houver fala literal inequívoca. Não crie fatos nem instrua sobre autoagressão.",
    "Retorne JSON com itens, erros_graves, acertos (máx. 4), melhorias (máx. 4), linha_evolucao (máx. 14). Cada item precisa de estado permitido e evidencia curta. Somente fatores_protecao e fatores_risco podem conter ajuste proporcional.",
    `ESTADOS PERMITIDOS: ${JSON.stringify(allowed)}`,
    `BASE JÁ OBSERVADA: ${JSON.stringify(baseline)}`,
    `CASO REVELADO NO ENCERRAMENTO: ${JSON.stringify({ fator_principal: input.internalCase.fator_principal, fatores_risco: input.internalCase.fatores_risco, fatores_protecao: input.internalCase.fatores_protecao, vinculos: input.internalCase.vinculos, perfil: input.internalCase.perfil_tipo })}`,
    `BRIEFING: ${JSON.stringify(input.briefing)}`,
    `TRANSCRIÇÃO: ${JSON.stringify(visibleTranscript)}`,
  ].join("\n\n");
  try {
    const response = await new OpenAI({ apiKey: key }).responses.create({ model: "gpt-4o-mini", store: false, max_output_tokens: 2200, input: [{ role: "developer", content: prompt }, { role: "user", content: "Gere a avaliação final em JSON." }], text: { format: { type: "json_object" } } });
    const parsed = JSON.parse(response.output_text) as { itens?: EvaluationSubmission["itens"]; erros_graves?: EvaluationSubmission["erros_graves"]; acertos?: unknown; melhorias?: unknown; linha_evolucao?: unknown };
    const errors = confirmedErrors(input.state);
    // A análise final aprimora os itens, mas não cria deduções graves novas.
    // Elas exigem detecção objetiva registrada durante a conversa.
    const modelItems = mergeFinalItems(deterministicItems, parsed.itens);
    const submission: EvaluationSubmission = { parcial: input.partial, itens: applyDialogueControl(modelItems, deliveredTranscript), erros_graves: errors };
    const calculation = calculateEvaluation(submission);
    const extras: FinalExtras = {
      acertos: Array.isArray(parsed.acertos) ? parsed.acertos.filter((x): x is string => typeof x === "string").slice(0, 4) : [],
      melhorias: Array.isArray(parsed.melhorias) ? parsed.melhorias.filter((x): x is string => typeof x === "string").slice(0, 4) : [],
      linha_evolucao: Array.isArray(parsed.linha_evolucao) ? parsed.linha_evolucao.filter((x): x is { fala: string; observacao: string } => Boolean(x && typeof x === "object" && typeof (x as { fala?: unknown }).fala === "string" && typeof (x as { observacao?: unknown }).observacao === "string")).slice(0, 14) : [],
    };
    return { ...calculation, ficha_caso: { fator_principal: input.internalCase.fator_principal, fatores_risco: input.internalCase.fatores_risco, fatores_protecao: input.internalCase.fatores_protecao, perfil: input.internalCase.perfil_tipo ?? "NÃO ESPECIFICADO" }, ...extras, motivo_encerramento: input.reason };
  } catch {
    return fallback(input.state, input.internalCase, deliveredTranscript, input.partial, input.reason);
  }
}
