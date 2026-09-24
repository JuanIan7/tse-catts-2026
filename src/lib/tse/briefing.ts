import type { Difficulty, PublicBriefing } from "./session-case";

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function list(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const entries = value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim());
  return entries.length ? entries : fallback;
}

export function normalizePublicBriefing(raw: unknown, difficulty: Difficulty): PublicBriefing {
  const value = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const context = text(value.contexto_observavel, "A equipe chega a uma ocorrência simulada e identifica uma pessoa adulta disponível para contato verbal.");
  const observables = list(value.observaveis_iniciais, ["pessoa adulta presente no local", "condições adequadas para iniciar contato verbal"]);
  return {
    titulo: text(value.titulo, "Ocorrência simulada — chegada da equipe"),
    dificuldade: difficulty,
    acionamento: text(value.acionamento, "A equipe foi acionada pela central para avaliar uma pessoa em sofrimento emocional e iniciar contato de forma segura."),
    contexto_observavel: context,
    informacoes_recebidas: list(value.informacoes_recebidas, ["A pessoa está sozinha no local.", "Os solicitantes pediram uma abordagem especializada e respeitosa."]),
    observaveis_iniciais: observables,
    condicoes_da_cena: list(value.condicoes_da_cena, ["ambiente preservado para a conversa", "equipe de apoio mantida a distância discreta"]),
    aparencia_observavel: text(value.aparencia_observavel, observables.join(", ")),
    orientacao: text(value.orientacao, "Inicie com apresentação clara, presença calma e escuta ativa. Trabalhe apenas com elementos observáveis ou revelados."),
  };
}
