import type { ItemSubmission } from "./scoring";
import { detectDialogueTools } from "./dialogue-tools";
import type { InternalCase } from "./session-case";

export type EvidenceTurn = { speaker: string; content: string; delivery_status?: string };
export type FactorMatch = { factor: string; speaker: string; content: string };

type ExitEvidence = {
  offer: FactorMatch | null;
  acceptance: FactorMatch | null;
};

export type TranscriptEvidence = {
  protection: FactorMatch[];
  risk: FactorMatch[];
  mainFactor: FactorMatch | null;
  tools: ReturnType<typeof detectDialogueTools>;
  exit: ExitEvidence;
};

const ignoredTerms = new Set([
  "a", "ao", "aos", "as", "com", "da", "das", "de", "do", "dos", "e", "em", "esta", "este", "foi", "na", "nas", "no", "nos", "o", "os", "para", "por", "que", "sem", "uma", "um",
  "recente", "recentes", "intenso", "intensa", "muito", "mais", "menos", "pessoa", "pessoas", "alguem", "algum", "alguma", "mantem", "manter", "contato", "vinculo", "afetivo", "afetiva",
]);
const broadAnchors = new Set(["cuidado", "familia", "isol", "sono", "medo", "perda", "conflito", "financeiro", "trabalho"]);

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function canonical(term: string) {
  if (/^(isol|sozin|afast|retra)/.test(term)) return "isol";
  if (/^(acompanh|tratament|consult|medic|remed|saude)/.test(term)) return "cuidado";
  if (/^(interromp|parei|parou|parar|suspens)/.test(term)) return "interromp";
  if (/^(morr|morte|falec|luto)/.test(term)) return "luto";
  if (/^(dorm|sono|inson)/.test(term)) return "sono";
  if (/^(desconfi|suspeit)/.test(term)) return "desconfi";
  if (/^(famil|parente)/.test(term)) return "familia";
  if (/^(trabalh|empreg|profiss)/.test(term)) return "trabalho";
  if (/^(amiz|amig)/.test(term)) return "amizade";
  if (/^(filh)/.test(term)) return "filho";
  if (/^(irma)/.test(term)) return "irma";
  if (/^(pai)$/.test(term)) return "pai";
  if (/^(mae)$/.test(term)) return "mae";
  if (/^(musica|musical|percuss)/.test(term)) return "musica";
  if (/^(arte|artist)/.test(term)) return "arte";
  if (/^(divid|divida|financeir|renda)/.test(term)) return "financeiro";
  if (/^(perd|demiss|desempreg)/.test(term)) return "perda";
  if (/^(culp)/.test(term)) return "culpa";
  if (/^(medo)/.test(term)) return "medo";
  if (/^(humilh|vergonh)/.test(term)) return "humilhacao";
  if (/^(conflit|discuss)/.test(term)) return "conflito";
  return term.length > 7 ? term.slice(0, 7) : term;
}

function terms(value: string) {
  return new Set(normalize(value).split(" ").map(canonical).filter((term) => term.length >= 3 && !ignoredTerms.has(term)));
}

function matchFactor(factor: string, related: string[], turn: EvidenceTurn) {
  const content = normalize(turn.content);
  const normalizedFactor = normalize(factor);
  if (!content || !normalizedFactor) return false;
  if (content.includes(normalizedFactor)) return true;

  const factorTerms = terms(factor);
  const turnTerms = terms(turn.content);
  const overlap = [...factorTerms].filter((term) => turnTerms.has(term));
  if (factorTerms.size <= 1) return overlap.length === 1;
  if (overlap.length >= 2) return true;

  // Um vínculo particular da ficha (por exemplo, pai ou filha) é suficiente
  // quando ele é a própria âncora do fator de proteção declarado.
  const relatedTerms = new Set(related.flatMap((value) => [...terms(value)]));
  return overlap.some((term) => relatedTerms.has(term) && !broadAnchors.has(term));
}

function firstMatch(factor: string, related: string[], turns: EvidenceTurn[]) {
  const turn = turns.find((candidate) => matchFactor(factor, related, candidate));
  return turn ? { factor, speaker: turn.speaker, content: turn.content.trim().slice(0, 500) } satisfies FactorMatch : null;
}

export function isSafeMedicalOffer(turn: EvidenceTurn) {
  if (turn.speaker !== "ALUNO") return false;
  const text = normalize(turn.content);
  const care = /\b(ambulanc[a-z]*|hospital|atendimento medico|atendimento especializado|medic[a-z]*|especialista[a-z]*|emergencia)\b/.test(text);
  const movement = /\b(vamos|ir|levar|acompanhar|conduzir|chamar|aceita|pode|seguir)\b/.test(text);
  return care && movement;
}

function acceptsOffer(turn: EvidenceTurn) {
  if (turn.speaker !== "PERSONAGEM") return false;
  const text = normalize(turn.content);
  if (/\b(nao vou|nao quero|nao aceito|nao vamos)\b/.test(text)) return false;
  return /\b(vamos(?: juntos)?|vamos sim|ta bom|eu vou|vou com voce|pode me levar|aceito|sim vamos)\b/.test(text);
}

function exitEvidence(turns: EvidenceTurn[]): ExitEvidence {
  let latestOffer: FactorMatch | null = null;
  for (let index = 0; index < turns.length; index += 1) {
    const offerTurn = turns[index];
    if (!isSafeMedicalOffer(offerTurn)) continue;
    const offer = { factor: "oferta segura de saída digna", speaker: offerTurn.speaker, content: offerTurn.content.trim().slice(0, 500) } satisfies FactorMatch;
    latestOffer = offer;

    // A concordância precisa responder à oferta médica atual. Uma recusa ou
    // mudança de assunto encerra esta tentativa; uma nova aceitação exige uma
    // nova oferta segura do aluno.
    const immediateReply = turns[index + 1];
    if (immediateReply && acceptsOffer(immediateReply)) {
      return {
        offer,
        acceptance: { factor: "aceitação inequívoca da saída digna", speaker: immediateReply.speaker, content: immediateReply.content.trim().slice(0, 500) },
      };
    }
  }
  return { offer: latestOffer, acceptance: null };
}

/**
 * Confere evidências na conversa contra a ficha privada do caso. A origem da
 * evidência pode ser o personagem ou o aluno: ao revelar um fator, o tentante
 * tornou a informação identificável durante a abordagem.
 */
export function analyzeTranscriptEvidence(internalCase: InternalCase, transcript: EvidenceTurn[]): TranscriptEvidence {
  const turns = transcript.filter((turn) => (turn.speaker === "ALUNO" || turn.speaker === "PERSONAGEM") && Boolean(turn.content.trim()));
  return {
    protection: internalCase.fatores_protecao.flatMap((factor) => {
      const match = firstMatch(factor, internalCase.vinculos, turns);
      return match ? [match] : [];
    }),
    risk: internalCase.fatores_risco.flatMap((factor) => {
      const match = firstMatch(factor, [...internalCase.ocultas, internalCase.fator_principal], turns);
      return match ? [match] : [];
    }),
    mainFactor: firstMatch(internalCase.fator_principal, internalCase.ocultas, turns),
    tools: detectDialogueTools(turns),
    exit: exitEvidence(turns),
  };
}

function joinedEvidence(matches: FactorMatch[]) {
  return matches.map((match) => `${match.speaker === "ALUNO" ? "Aluno" : "Tentante"}: ${match.content}`).join(" | ").slice(0, 500);
}

export function factorItemsFromEvidence(internalCase: InternalCase, evidence: TranscriptEvidence): Partial<Record<"fatores_protecao" | "fatores_risco" | "fator_principal", ItemSubmission>> {
  const items: Partial<Record<"fatores_protecao" | "fatores_risco" | "fator_principal", ItemSubmission>> = {};
  if (evidence.protection.length) {
    items.fatores_protecao = {
      estado: "encontrou_explorou",
      ajuste: evidence.protection.length / internalCase.fatores_protecao.length,
      evidencia: `Fator(es) de proteção revelado(s) na conversa: ${joinedEvidence(evidence.protection)}`,
    };
  }
  if (evidence.risk.length) {
    items.fatores_risco = {
      estado: "encontrou_isolou",
      ajuste: evidence.risk.length / internalCase.fatores_risco.length,
      evidencia: `Fator(es) de risco revelado(s) na conversa: ${joinedEvidence(evidence.risk)}`,
    };
  }
  if (evidence.mainFactor) {
    items.fator_principal = {
      estado: "encontrou_isolou",
      evidencia: `Fator principal revelado na conversa: ${evidence.mainFactor.speaker === "ALUNO" ? "Aluno" : "Tentante"}: ${evidence.mainFactor.content}`.slice(0, 500),
    };
  }
  return items;
}

export function didacticSignalsFromEvidence(evidence: TranscriptEvidence) {
  const signals: { item_id: string; estado: string; evidencia: string }[] = [];
  if (evidence.protection.length) signals.push({ item_id: "fatores_protecao", estado: "encontrou_explorou", evidencia: joinedEvidence(evidence.protection) });
  if (evidence.risk.length) signals.push({ item_id: "fatores_risco", estado: "encontrou_isolou", evidencia: joinedEvidence(evidence.risk) });
  if (evidence.mainFactor) signals.push({ item_id: "fator_principal", estado: "encontrou_isolou", evidencia: evidence.mainFactor.content });
  if (evidence.tools.parafrase) signals.push({ item_id: "parafrase_resumida", estado: "feito", evidencia: evidence.tools.parafrase });
  if (evidence.tools.memoria) signals.push({ item_id: "memoria_linkada", estado: "feito", evidencia: evidence.tools.memoria });
  if (evidence.tools.teia) signals.push({ item_id: "maieutica_ou_teia", estado: "feito", evidencia: evidence.tools.teia });
  return signals;
}

export function hasAcceptedSafeExit(evidence: TranscriptEvidence) {
  return Boolean(evidence.exit.offer && evidence.exit.acceptance);
}
