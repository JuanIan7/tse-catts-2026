import { describe, expect, it } from "vitest";
import { applyDidacticSignals, calculateDidacticEvaluation, createDidacticState, readDidacticState, registerInitialSilence, seriousOccurrenceCount, toEvaluationSubmission } from "./didactic-state";

describe("estado didático no servidor", () => {
  it("não presume conduta física e só acumula evidência compatível com o barema", () => {
    const state = applyDidacticSignals(createDidacticState(), {
      rapport_delta: 1,
      categorias_reveladas: ["VINCULO"],
      evidencias: [
        { item_id: "apresentacao_pessoal", estado: "feito", evidencia: "A pessoa participante se apresentou." },
        { item_id: "fatores_protecao", estado: "encontrou_explorou", evidencia: "Explorou um vínculo protetivo revelado na conversa." },
        { item_id: "aproximacao_calma_silenciosa", estado: "feito", evidencia: "Não deveria ser aceito sem observação." },
      ],
      erros_graves: [],
      acceptsExit: false,
    });
    const submission = toEvaluationSubmission(state);
    expect(submission.itens.apresentacao_pessoal).toMatchObject({ estado: "feito" });
    expect(submission.itens.fatores_protecao).toMatchObject({ estado: "encontrou_explorou" });
    expect(submission.itens.aproximacao_calma_silenciosa).toMatchObject({ estado: "nao_observavel" });
    expect(calculateDidacticEvaluation(state).cobertura.avaliados).toBe(13);
    expect(calculateDidacticEvaluation(createDidacticState()).nota_final).toBeLessThan(10);
  });

  it("descarta estado adulterado e mantém a forma pública sem ficha interna", () => {
    const state = readDidacticState({
      revision: 7,
      itens: { fator_principal: { estado: "inventado", evidencias: ["x"] } },
      categorias_reveladas: { risco: 9, protecao: -2, vinculo: 1 },
    });
    expect(state.revision).toBe(7);
    expect(state.itens.fator_principal).toBeUndefined();
    expect(state.categorias_reveladas).toEqual({ risco: 3, protecao: 0, vinculo: 1 });
    expect(JSON.stringify(state)).not.toContain("ocultas");
  });

  it("conta ocorrências graves separadas até o limite", () => {
    let state = createDidacticState();
    for (let index = 0; index < 6; index += 1) {
      state = applyDidacticSignals(state, { rapport_delta: 0, categorias_reveladas: [], evidencias: [], erros_graves: [{ erro_id: "mentir", evidencia: "evidência " + index }], acceptsExit: false });
    }
    expect(seriousOccurrenceCount(state)).toBe(6);
  });

  it("registra o silêncio inicial uma única vez e antes da primeira fala", () => {
    const first = registerInitialSilence(createDidacticState());
    expect(first.recorded).toBe(true);
    expect(toEvaluationSubmission(first.state).itens.silencio_inicial).toMatchObject({ estado: "feito" });
    expect(registerInitialSilence(first.state).recorded).toBe(false);
    const afterTurn = applyDidacticSignals(first.state, { rapport_delta: 0, categorias_reveladas: [], evidencias: [], erros_graves: [], acceptsExit: false });
    expect(registerInitialSilence(afterTurn).recorded).toBe(false);
  });
});
