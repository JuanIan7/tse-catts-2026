import { describe, expect, it } from "vitest";
import { responseFlow, simpleQuestionTopic } from "./difficulty-flow";
import { questionKinds } from "./dialogue-tools";

describe("fluxo progressivo de dificuldade", () => {
  it("reconhece perguntas simples de treino", () => {
    expect(simpleQuestionTopic("Você é casado?")).toBe("CASAMENTO");
    expect(simpleQuestionTopic("Você tem filhos?")).toBe("FILHOS");
    expect(simpleQuestionTopic("Seu pai é vivo?")).toBe("PAIS");
    expect(simpleQuestionTopic("Você pratica esportes?")).toBe("ESPORTE");
  });

  it("exige aprofundamento do mesmo assunto para a pergunta complexa", () => {
    expect(questionKinds([{ speaker: "ALUNO", content: "Você tem filhos?" }, { speaker: "ALUNO", content: "Como é sua relação com seus filhos?" }]).complex).toBeTruthy();
    expect(questionKinds([{ speaker: "ALUNO", content: "Você tem filhos?" }, { speaker: "ALUNO", content: "Como está o clima hoje?" }]).complex).toBeNull();
  });

  it("obriga resposta imediata no médio", () => {
    expect(responseFlow("FACIL", [{ speaker: "ALUNO", content: "Você é casado?" }]).mustAnswer).toBe(true);
  });

  it("libera o fluxo no difícil e muito difícil após a fase inicial", () => {
    const turns = ["Você é casado?", "Você tem filhos?", "Seu pai é vivo?", "Você trabalha?"].map((content) => ({ speaker: "ALUNO", content }));
    expect(responseFlow("MEDIA", turns).mustAnswer).toBe(true);
    expect(responseFlow("DIFICIL", turns).mustAnswer).toBe(true);
  });
});
