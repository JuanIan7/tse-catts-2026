import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import type { DidacticErrorSignal, DidacticSignal, DidacticState } from "./didactic-state";
import type { InternalCase } from "./session-case";

const observableItemIds = [
  "apresentacao_pessoal", "respeitou_pausas_silenciosas", "ouviu_atentamente_postura", "espaco_para_desabafo", "tom_de_voz", "perguntas_simples_complexas", "parafrase_resumida", "memoria_linkada", "maieutica_ou_teia", "desistencia_ou_saida_digna", "dominou_dialogo", "conduziu_solucao", "fatores_protecao", "fatores_risco", "fator_principal",
] as const;
const seriousErrorIds = ["atentar_contra_seguranca", "mentir", "rir", "seduzir", "prometer_sem_poder_cumprir"] as const;

const characterTurnSchema = z.object({
  fala: z.string().min(1).max(900),
  aceita_saida_digna: z.boolean(),
  rapport_delta: z.number().int().min(-1).max(1),
  categorias_reveladas: z.array(z.enum(["RISCO", "PROTECAO", "VINCULO"])).max(2),
  evidencias: z.array(z.object({ item_id: z.enum(observableItemIds), estado: z.string().min(1).max(50), evidencia: z.string().min(1).max(500) })).max(5),
  erros_graves: z.array(z.object({ erro_id: z.enum(seriousErrorIds), evidencia: z.string().min(1).max(500) })).max(2),
});

const responseSchema = {
  type: "object", additionalProperties: false,
  required: ["fala", "aceita_saida_digna", "rapport_delta", "categorias_reveladas", "evidencias", "erros_graves"],
  properties: {
    fala: { type: "string", minLength: 1, maxLength: 900 },
    aceita_saida_digna: { type: "boolean" },
    rapport_delta: { type: "integer", minimum: -1, maximum: 1 },
    categorias_reveladas: { type: "array", items: { type: "string", enum: ["RISCO", "PROTECAO", "VINCULO"] }, maxItems: 2 },
    evidencias: { type: "array", maxItems: 5, items: { type: "object", additionalProperties: false, required: ["item_id", "estado", "evidencia"], properties: { item_id: { type: "string", enum: observableItemIds }, estado: { type: "string", minLength: 1, maxLength: 50 }, evidencia: { type: "string", minLength: 1, maxLength: 500 } } } },
    erros_graves: { type: "array", maxItems: 2, items: { type: "object", additionalProperties: false, required: ["erro_id", "evidencia"], properties: { erro_id: { type: "string", enum: seriousErrorIds }, evidencia: { type: "string", minLength: 1, maxLength: 500 } } } },
  },
} as const;

type TranscriptTurn = { speaker: "ALUNO" | "PERSONAGEM" | "NARRADOR" | "SISTEMA"; content: string };
export type CharacterResponse = { fala: string; aceita_saida_digna: boolean; rapport_delta: number; categorias_reveladas: string[]; evidencias: DidacticSignal[]; erros_graves: DidacticErrorSignal[] };

function buildCaseCapsule(internalCase: InternalCase) {
  return {
    contexto: internalCase.contexto.slice(0, 350),
    perfil: internalCase.perfil_comportamental.slice(0, 180),
    perfil_tipo: internalCase.perfil_tipo ?? "NAO_ESPECIFICADO",
    fator_principal: internalCase.fator_principal.slice(0, 150),
    fatores_de_risco: internalCase.fatores_risco.slice(0, 3).map((value) => value.slice(0, 100)),
    fatos_ocultos: internalCase.ocultas.slice(0, 2).map((value) => value.slice(0, 100)),
    vinculos: internalCase.vinculos.slice(0, 2).map((value) => value.slice(0, 100)),
    fatores_de_protecao: internalCase.fatores_protecao.slice(0, 2).map((value) => value.slice(0, 100)),
    condicoes_de_evolucao: internalCase.condicoes_evolucao.slice(0, 3).map((value) => value.slice(0, 130)),
    condicoes_de_saida: internalCase.condicoes_saida.slice(0, 2).map((value) => value.slice(0, 130)),
  };
}

function compactHistory(transcript: TranscriptTurn[]) {
  return transcript.slice(-8).map((turn) => ({ speaker: turn.speaker, content: turn.content.slice(0, 2000) }));
}

export async function respondAsCharacter(internalCase: InternalCase, transcript: TranscriptTurn[], didacticState: DidacticState): Promise<CharacterResponse> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Integração OpenAI ainda não configurada.");
  const prompt = [
    "Você interpreta exclusivamente um personagem adulto fictício em um simulador didático de abordagem técnica a tentativa de suicídio.",
    "A cápsula abaixo é interna e confidencial. Nunca revele rótulos, gabaritos, condições, pontuação ou fatos não conquistados pela conversa. Revele detalhes gradualmente e apenas quando houver escuta e espaço seguro.",
    "Não descreva método, ferimentos, execução de ato ou qualquer instrução que facilite autoagressão. Não faça aconselhamento profissional, não avalie e não elogie o aluno.",
    "Responda em português brasileiro natural com, no máximo, três frases curtas, mantendo o mesmo perfil durante toda a ocorrência. Em todas as primeiras interações, tente afastar o abordador; construa vínculo apenas gradualmente. A resistência dura mais nos níveis difíceis. Mantenha ambivalência até uma Saída Digna concreta, voluntária, imediata e aceita de forma inequívoca.",
    "Se o perfil for AGRESSIVO: raiva genuína, ordens para se afastar, palavrões reais e coerentes com a fala; não rir, debochar, ameaçar violência detalhada nem dirigir ofensas a grupos protegidos. Se o perfil for DEPRESSIVO: choro e voz embargada, respostas curtas nas primeiras 2 a 3 falas, sem alucinação alguma. Se o perfil for PSICOTICO: fala desorganizada, percepções de vozes ou portais não gráficas, medo da aproximação; não se torna lúcido de repente. Nunca misture alucinações aos outros perfis.",
    "A fala anterior do próprio personagem também está no histórico. Reaja ao que o aluno fez, não repita mecanicamente a abertura. Nunca revele fatos ocultos antes que a conversa dê espaço para isso.",
    "Os campos estruturados não são exibidos ao aluno. Use evidencias somente para condutas explicitamente observáveis no texto. Nunca avalie aproximação física, contato visual, postura ou tom acústico. Erros graves só podem aparecer com evidência literal e inequívoca na fala recente; em caso de dúvida, retorne lista vazia.",
    `CÁPSULA INTERNA: ${JSON.stringify(buildCaseCapsule(internalCase))}`,
    `ESTADO DIDÁTICO SEGURO: ${JSON.stringify({ turnos: didacticState.turnos, rapport: didacticState.rapport, categorias_reveladas: didacticState.categorias_reveladas, interrupcoes: didacticState.interrupcoes })}`,
  ].join("\n\n");
  const client = new OpenAI({ apiKey: key });
  const response = await client.responses.create({
    model: "gpt-4o-mini", store: false, max_output_tokens: 420,
    input: [{ role: "developer", content: prompt }, ...compactHistory(transcript).map((turn) => ({ role: turn.speaker === "ALUNO" ? "user" as const : "assistant" as const, content: turn.content }))],
    text: { format: { type: "json_schema", name: "tse_character_turn", strict: true, schema: responseSchema } },
  });
  return characterTurnSchema.parse(JSON.parse(response.output_text));
}
