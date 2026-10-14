type TranscriptTurn = { speaker: string; content: string; delivery_status?: string };
type Item = { estado: string } | string | undefined;

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

const genericWords = new Set(["voce", "senhor", "senhora", "minha", "minhas", "meus", "nosso", "nossa", "estou", "estava", "estive", "agora", "ainda", "entao", "tambem", "porque", "quando", "muito", "muita", "sobre", "aqui", "junto", "juntos"]);

function topicTerms(value: string) {
  return new Set((normalized(value).match(/\b(?:[a-z]{5,}|pai|mae|avo|irma)\b/g) ?? [])
    .filter((word) => !genericWords.has(word))
    .map((word) => word.slice(0, 5)));
}

export function detectDialogueTools(transcript: TranscriptTurn[]) {
  let parafrase: string | null = null;
  let memoria: string | null = null;
  let teia: string | null = null;
  const revealedTerms = new Set<string>();
  let lastCharacterText = "";
  let studentQuestionCount = 0;
  let priorQuestionTerms = new Set<string>();
  for (const turn of transcript) {
    if (turn.speaker === "PERSONAGEM") {
      lastCharacterText = normalized(turn.content);
      for (const word of topicTerms(lastCharacterText)) revealedTerms.add(word);
      continue;
    }
    if (turn.speaker !== "ALUNO") continue;
    const text = normalized(turn.content);
    const isQuestion = /\?/.test(turn.content);
    const currentQuestionTerms = new Set((text.match(/[a-z]{5,}/g) ?? []).map((word) => word.slice(0, 5)));
    const relatedToPriorQuestion = [...currentQuestionTerms].some((term) => priorQuestionTerms.has(term));
    if (isQuestion) studentQuestionCount += 1;
    const recalledTerms = new Set([...topicTerms(text)].filter((word) => revealedTerms.has(word)));
    const summarizesAndChecks = /\b(deixa eu ver se eu entendi|deixa eu entender|entao quer dizer que|entao deixa eu ver|pelo que entendi|voce disse|voce contou)\b/.test(text)
      || /\b(entendi (direito|certo)|e isso|confere|estou entendendo|correto)\b/.test(text);
    if (!parafrase && summarizesAndChecks && isQuestion && recalledTerms.size >= 2) {
      parafrase = turn.content.trim().slice(0, 500);
    }
    const positivePastOrFuture = /\b(quando (ela|ele) nasceu|homenagem|orgulh\w*|feliz\w*|formatur\w*|comemor\w*|alegr\w*|aniversar\w*|bom momento|lembranca boa|reencontrar)\b/.test(text) || /\b(imagina|imagine)\b.*\b(voltar|reencontrar|abracar|estar com|ver novamente)\b/.test(text);
    const referencesKnownMoment = recalledTerms.size >= 1 || (/\b(como foi quando ela nasceu|quando ele nasceu)\b/.test(text) && /\b(ela|ele|filha|filho)\b/.test(lastCharacterText));
    if (!memoria && positivePastOrFuture && referencesKnownMoment && /\b(como foi( quando| aquele| esse| o)?|voce lembra|o senhor lembra|a senhora lembra|consegue se lembrar|se recorda|imagina voce|imagine voce)\b/.test(text) && isQuestion) {
      memoria = turn.content.trim().slice(0, 500);
    }
    const alternatives = text.split(/\bou\b/).map((part) => part.trim()).filter(Boolean);
    const positive = /(ajuda|especialista|psicolog|hospital|ambulancia|atendimento|irma|irmao|famil|acompanhar|comigo|segur|cuidado)/;
    const offersChoices = alternatives.length >= 2 && alternatives.every((part) => positive.test(part));
    const chainedReflection = studentQuestionCount >= 2 && relatedToPriorQuestion && recalledTerms.size >= 1 && /\b(entao quer dizer|voce conhece|ja viu|o que aconteceria se)\b/.test(text) && /\?/.test(turn.content);
    const linkedReflection = recalledTerms.size >= 1 && /\bse\b.*\b(o que voce (pediria|faria|escolheria|diria|precisaria|poderia)|como voce (poderia|faria)|qual seria (o|seu) (passo|escolha))\b/.test(text) && /\b(ajuda|acompanhar|atendimento|cuidado|seguranca|proximo passo)\b/.test(text) && isQuestion;
    if (!teia && (offersChoices || chainedReflection || linkedReflection)) teia = turn.content.trim().slice(0, 500);
    if (isQuestion) priorQuestionTerms = currentQuestionTerms;
  }
  return { parafrase, memoria, teia };
}

const simpleQuestionPattern = /^(voce|o senhor|a senhora|seu|sua|seus|suas|ele|ela|eles|elas|e|esta|tem|teve|trabalha|pratica|possui|mora|vive|conhece|gosta|prefere|pode|quer|consegue|sabe)\b/;
const nameQuestionPattern = /^(qual (e )?(o )?(seu|sua) nome|qual (e )?(o )?nome (dele|dela)|como (voce|o senhor|a senhora) se chama|seu nome)\b/;
const questionStartPattern = /\b(voce|o senhor|a senhora|seu|sua|seus|suas|ele|ela|eles|elas|qual|quais|como|quando|quanto|de que forma|por que|porque|o que|quem|onde|e|esta|tem|teve|trabalha|pratica|possui|mora|vive|conhece|gosta|prefere|pode|quer|consegue|sabe)\b/;

export function questionKinds(transcript: TranscriptTurn[]) {
  let simple: string | null = null;
  let complex: string | null = null;
  let simpleTerms = new Set<string>();
  for (const turn of transcript) {
    if (turn.speaker !== "ALUNO") continue;
    for (const clause of turn.content.match(/[^?.!]*\?/g) ?? []) {
      const rawText = normalized(clause);
      const questionStart = questionStartPattern.exec(rawText);
      if (!questionStart) continue;
      const text = rawText.slice(questionStart.index);
      const isNameQuestion = nameQuestionPattern.test(text);
      const isComplexLead = /\b(como|por que|porque|qual|quais|quando|quanto|quem|onde|de que forma|o que)\b/.test(text) && !isNameQuestion;
      const isSimple = isNameQuestion || (!isComplexLead && simpleQuestionPattern.test(text));
      if (isSimple) {
        if (!simple) simple = turn.content.trim().slice(0, 500);
        for (const word of topicTerms(text)) simpleTerms.add(word);
      }
      const complexTerms = topicTerms(text);
      if (isComplexLead && !isSimple && [...complexTerms].some((term) => simpleTerms.has(term)) && !complex) complex = turn.content.trim().slice(0, 500);
    }
  }
  return { simple, complex };
}

export function countDialogueMemoryErrors(transcript: TranscriptTurn[]) {
  const questions = new Set<string>();
  const knownNames = new Set<string>();
  const knownFacts = new Set<string>();
  let errors = 0;
  for (const turn of transcript) {
    const text = normalized(turn.content);
    if (turn.speaker === "PERSONAGEM") {
      const declared = text.match(/\b(?:meu nome e|me chamo|sou simplesmente)\s+(?:o|a)?\s*([a-z]{2,})/);
      if (declared?.[1]) knownNames.add(declared[1]);
      if (/\bex[ -]mulher\b/.test(text)) knownFacts.add("ex_mulher");
      if (/\bex[ -]marido\b/.test(text)) knownFacts.add("ex_marido");
      continue;
    }
    if (turn.speaker !== "ALUNO") continue;
    const question = text.split("?")[0]?.replace(/\b(voce|o senhor|a senhora|me|por favor)\b/g, "").replace(/\s+/g, " ").trim();
    if (question.length >= 12 && questions.has(question)) errors += 1;
    if (question.length >= 12) questions.add(question);
    const assignedName = text.match(/\b(?:seu nome|o nome dela|o nome dele)\s+(?:e|era)\s+([a-z]{2,})/);
    if (assignedName?.[1] && knownNames.size > 0 && !knownNames.has(assignedName[1])) errors += 1;
    if (knownFacts.has("ex_mulher") && /\bsua mulher\b/.test(text) && !/\bex[ -]mulher\b/.test(text)) errors += 1;
    if (knownFacts.has("ex_marido") && /\bseu marido\b/.test(text) && !/\bex[ -]marido\b/.test(text)) errors += 1;
  }
  return errors;
}

export function hasDialogueMemoryError(transcript: TranscriptTurn[]) { return countDialogueMemoryErrors(transcript) > 0; }

function positive(item: Item) {
  const state = typeof item === "string" ? item : item?.estado;
  return state === "feito" || state === "adequado" || state === "encontrou_explorou" || state === "encontrou_isolou";
}

export function dialogueControlState(items: Record<string, Item>, transcript: TranscriptTurn[]) {
  const reciprocalTurns = transcript.reduce((count, turn, index) => {
    if (turn.speaker !== "ALUNO") return count;
    const nextDialogueTurn = transcript.slice(index + 1).find((next) => next.speaker === "ALUNO" || next.speaker === "PERSONAGEM");
    return count + (nextDialogueTurn?.speaker === "PERSONAGEM" && nextDialogueTurn.delivery_status !== "INTERROMPIDO" ? 1 : 0);
  }, 0);
  const tools = ["parafrase_resumida", "memoria_linkada", "maieutica_ou_teia", "desistencia_ou_saida_digna"];
  const hasCore = reciprocalTurns >= 3 && positive(items.fatores_protecao) && positive(items.fatores_risco) && tools.some((id) => positive(items[id]));
  const memoryErrors = countDialogueMemoryErrors(transcript);
  const interrupted = transcript.some((turn) => turn.delivery_status === "INTERROMPIDO");
  return hasCore && memoryErrors === 0 && !interrupted ? "feito" : hasCore && memoryErrors <= 1 ? "parcial" : "nao_feito";
}
