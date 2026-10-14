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

const positiveIdeaPattern = /\b(gost\w*|amava|ama|amo|alegr\w*|prazer|feliz\w*|orgulh\w*|importan\w*|proxim\w*|carinh\w*|corag\w*|ajud\w*|cuid\w*|calm\w*|confi\w*|sorr\w*|junto\w*|graca|bem|bom|boa|ensin\w*|aprend\w*|organiz\w*)\b/;
const genericPositiveTerms = new Set(["gosta", "alegr", "feliz", "orgul", "impor", "proxi", "carin", "corag", "ajuda", "cuida", "calma", "confi", "sorri", "junto", "graca"]);

function positiveIdeas(value: string) {
  return normalized(value).split(/[.;]|\s+e\s+|\s+mas\s+/)
    .filter((clause) => positiveIdeaPattern.test(clause) && !/\b(nao|nunca|jamais|sem)\b/.test(clause))
    .map(topicTerms)
    .filter((terms) => terms.size > 0);
}

function positiveMoments(value: string) {
  const sentences = normalized(value).split(/[.!?;]/).map((sentence) => sentence.trim()).filter(Boolean);
  return sentences.flatMap((sentence, index) => {
    if (positiveIdeas(sentence).length === 0) return [];
    const context = /^(ela|ele|esse|essa|isso|aquele|aquela)\b/.test(sentence) ? `${sentences[index - 1] ?? ""} ${sentence}` : sentence;
    return [topicTerms(context)];
  });
}

function recallsTwoPositiveIdeas(summary: string, ideas: Set<string>[]) {
  const summarized = positiveIdeas(summary);
  const used = new Set<number>();
  let count = 0;
  for (const clause of summarized) {
    const match = ideas.findIndex((idea, index) => !used.has(index) && [...clause].some((term) => idea.has(term) && !genericPositiveTerms.has(term)));
    if (match < 0) continue;
    used.add(match);
    count += 1;
    if (count >= 2) return true;
  }
  return false;
}

function maieuticSequence(transcript: TranscriptTurn[]) {
  const dialogue = transcript.filter((turn) => turn.speaker === "ALUNO" || turn.speaker === "PERSONAGEM");
  let chain: { question: string; answer: string; start: number; end: number }[] = [];
  for (let i = 0; i < dialogue.length - 1; i += 1) {
    const question = dialogue[i];
    const answer = dialogue[i + 1];
    if (question.speaker !== "ALUNO" || !question.content.includes("?") || answer.speaker !== "PERSONAGEM" || answer.delivery_status === "INTERROMPIDO") continue;
    chain = chain.at(-1)?.end === i - 1 ? [...chain, { question: question.content, answer: answer.content, start: i, end: i + 1 }] : [{ question: question.content, answer: answer.content, start: i, end: i + 1 }];
    const recent = chain.slice(-5);
    if (recent.length < 3) continue;
    const last = recent.at(-1)!;
    const finalQuestion = normalized(last.question);
    const conclusion = normalized(last.answer);
    if (!/\b(qual|como|o que)\b.*\b(primeiro passo|possivel|conclu\w*|fazer|escolher)\b/.test(finalQuestion)) continue;
    if (!/\b(posso|consigo|e possivel|nao e impossivel|nao preciso|vou|aceito)\b/.test(conclusion)) continue;
    const priorRevelations = new Set(dialogue.slice(0, recent[0].start).filter((turn) => turn.speaker === "PERSONAGEM").flatMap((turn) => [...topicTerms(turn.content)]));
    if (![...topicTerms(recent[0].question)].some((term) => priorRevelations.has(term))) continue;
    const reflectiveQuestions = recent.slice(1).filter((pair) => /\b(o que|se|entao|quando|precisou|conseguiu|qual|como)\b/.test(normalized(pair.question)));
    if (reflectiveQuestions.length < 2) continue;
    const linkedSteps = recent.slice(1).filter((pair, step) => {
      const previous = recent[step];
      const previousTerms = new Set([...topicTerms(previous.question), ...topicTerms(previous.answer)]);
      return [...topicTerms(pair.question)].some((term) => previousTerms.has(term))
        || /\b(a ajudou|o ajudou|naquele dia|nessa situacao|desse exemplo|dessa resposta|isso|essa primeira|esse primeiro)\b/.test(normalized(pair.question));
    });
    if (linkedSteps.length < Math.ceil((recent.length - 1) / 2)) continue;
    return `${recent.map((pair) => pair.question).join(" | ")} | Tentante: ${last.answer}`.slice(0, 500);
  }
  return null;
}

export function detectDialogueTools(transcript: TranscriptTurn[]) {
  let parafrase: string | null = null;
  let memoria: string | null = null;
  const ideas: Set<string>[] = [];
  const knownPositiveMoments: Set<string>[] = [];
  const revealedTerms = new Set<string>();
  let lastCharacterText = "";
  for (const turn of transcript) {
    if (turn.speaker === "PERSONAGEM") {
      lastCharacterText = normalized(turn.content);
      for (const word of topicTerms(lastCharacterText)) revealedTerms.add(word);
      ideas.push(...positiveIdeas(turn.content));
      knownPositiveMoments.push(...positiveMoments(turn.content));
      continue;
    }
    if (turn.speaker !== "ALUNO") continue;
    const text = normalized(turn.content);
    const isQuestion = /\?/.test(turn.content);
    const recalledTerms = new Set([...topicTerms(text)].filter((word) => revealedTerms.has(word)));
    const summarizesAndChecks = /\b(deixa eu ver se eu entendi|deixa eu entender|entao quer dizer que|entao deixa eu ver|pelo que entendi|voce disse|voce contou)\b/.test(text)
      || /\b(entendi (direito|certo)|e isso|confere|estou entendendo|correto)\b/.test(text);
    if (!parafrase && summarizesAndChecks && text.endsWith("?") && recallsTwoPositiveIdeas(text, ideas)) {
      parafrase = turn.content.trim().slice(0, 500);
    }
    const positivePastOrFuture = /\b(quando (ela|ele) nasceu|homenagem|orgulh\w*|feliz\w*|formatur\w*|comemor\w*|alegr\w*|aniversar\w*|bom momento|lembranca boa|reencontrar|dia bom|momento bom)\b/.test(text) || /\b(imagina\w*|imagine)\b.*\b(voltar|reencontrar|abracar|estar com|ver novamente|caminh\w*|tranquil\w*|bom|boa|calm\w*)\b/.test(text);
    const referencesKnownMoment = knownPositiveMoments.some((idea) => [...recalledTerms].some((term) => idea.has(term) && !genericPositiveTerms.has(term)));
    if (!memoria && positivePastOrFuture && referencesKnownMoment && /\b(como foi( quando| aquele| esse| o)?|voce lembra|o senhor lembra|a senhora lembra|consegue se lembrar|se recorda|consegue imaginar|imagina voce|imagine voce)\b/.test(text) && isQuestion) {
      memoria = turn.content.trim().slice(0, 500);
    }
  }
  return { parafrase, memoria, teia: maieuticSequence(transcript) };
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
