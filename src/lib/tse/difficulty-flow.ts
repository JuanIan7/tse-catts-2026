import type { Difficulty } from "./session-case";

type Turn = { speaker: string; content: string };

export type SimpleQuestionTopic = "NOME" | "CASAMENTO" | "FILHOS" | "PAIS" | "AVOS" | "ESPORTE" | "TRABALHO" | "CACHORRO" | "OUTRA";

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function simpleQuestionTopic(content: string): SimpleQuestionTopic | null {
  const text = normalized(content);
  if (!/\?/.test(text)) return null;
  if (/\b(nome\b|como (voce|o senhor|a senhora) (se chama|chama))/.test(text)) return "NOME";
  if (/(casad|espos[ao]|marido|mulher)/.test(text)) return "CASAMENTO";
  if (/\b(filh[oa]s?)\b/.test(text)) return "FILHOS";
  if (/\b(mae|pai).*(vive|vivo|viva)|\b(seu|sua).*(mae|pai)\b/.test(text)) return "PAIS";
  if (/\bavo[s]?|avo[s]?\b/.test(text)) return "AVOS";
  if (/\b(esporte[s]?|atividade fisica)\b/.test(text)) return "ESPORTE";
  if (/\b(trabalha|emprego|profissao)\b/.test(text)) return "TRABALHO";
  if (/\b(cachorro|animal de estimacao|pet)\b/.test(text)) return "CACHORRO";
  if (/\b(voce|o senhor|a senhora).*(tem|e|esta|mora|vive|conhece|gosta)\b/.test(text)) return "OUTRA";
  return null;
}

function refusal(content: string) {
  return /\b(nao quero falar|nao vou falar|nao interessa|nao e da sua conta|me deixa|nao quero responder)\b/.test(normalized(content));
}

export function responseFlow(difficulty: Difficulty, transcript: Turn[]) {
  const studentQuestions = transcript.filter((turn) => turn.speaker === "ALUNO" && simpleQuestionTopic(turn.content));
  const lastQuestion = [...studentQuestions].at(-1);
  const topic = lastQuestion ? simpleQuestionTopic(lastQuestion.content) : null;
  const askedTopicCount = topic ? studentQuestions.filter((turn) => simpleQuestionTopic(turn.content) === topic).length : 0;
  const characterRefusals = transcript.filter((turn) => turn.speaker === "PERSONAGEM" && refusal(turn.content)).length;
  const simpleCount = studentQuestions.length;
  const mustAnswer = Boolean(topic) && (
    difficulty === "FACIL"
      || (difficulty === "MEDIA" && (topic === "NOME" ? askedTopicCount >= 2 : simpleCount >= 3 || characterRefusals >= 2))
      || (difficulty === "DIFICIL" && (simpleCount >= 4 || characterRefusals >= 3))
  );
  return { topic, simpleCount, askedTopicCount, characterRefusals, mustAnswer };
}

export function responseFlowInstruction(difficulty: Difficulty, transcript: Turn[]) {
  const flow = responseFlow(difficulty, transcript);
  const common = "Responda somente ao que foi perguntado, sem entregar fator de risco ou proteção não solicitado.";
  if (!flow.topic) return `${common} A última fala não exige uma resposta direta de pergunta simples.`;
  if (flow.mustAnswer) return `${common} A última fala é uma pergunta simples sobre ${flow.topic}. RESPONDA DIRETAMENTE AGORA, em frase curta; não recuse e não mude de assunto.`;
  if (difficulty === "FACIL") return `${common} No nível Médio, responda diretamente a toda pergunta simples, inclusive nome, desde a primeira vez.`;
  if (difficulty === "MEDIA") return `${common} No nível Difícil, a primeira pergunta sobre nome pode receber recusa breve, mas a segunda deve ser respondida. Só até duas perguntas simples iniciais podem receber recusa; depois a conversa precisa fluir.`;
  return `${common} No nível Muito difícil, comece reativo, mas após três ou quatro perguntas simples responda gradualmente e alterne abertura com hesitação; nunca mantenha cinco ou mais perguntas simples sem resposta.`;
}
