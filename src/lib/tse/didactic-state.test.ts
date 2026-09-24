import { describe, expect, it } from "vitest";
import { applyDidacticSignals, calculateDidacticEvaluation, createDidacticState, readDidacticState, toEvaluationSubmission } from "./didactic-state";

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
    expect(calculateDidacticEvaluation(state).cobertura.avaliados).toBe(2);
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
});
