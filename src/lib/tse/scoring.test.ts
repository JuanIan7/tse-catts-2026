import { describe, expect, it } from "vitest";
import { calculateEvaluation, testSubmission } from "./scoring";

describe("motor de pontuação TSE v0.4", () => {
  it("fecha em 10 pontos e aceita frações somente nos fatores", () => {
    const best = calculateEvaluation(testSubmission("best"));
    expect(best.nota_final).toBe(10);
    expect(best.cobertura.avaliados).toBe(17);

    const partial = calculateEvaluation(testSubmission("not_observable"));
    expect(partial.nota_final).toBe(0);
    expect(partial.cobertura.avaliados).toBe(0);

    const poor = testSubmission("worst");
    poor.erros_graves = { atentar_contra_seguranca: { aplicado: true, evidencia: "conduta fictícia de teste" } };
    expect(calculateEvaluation(poor).nota_final).toBe(0);

    const rounding = testSubmission("best");
    rounding.itens.fatores_protecao = { estado: "encontrou_explorou", ajuste: 1 / 3, evidencia: "um de três fatores" };
    rounding.itens.fatores_risco = { estado: "encontrou_isolou", ajuste: 1 / 2, evidencia: "um de dois fatores" };
    const result = calculateEvaluation(rounding);
    expect(result.nota_bruta).toBeCloseTo(8.8333333333);
    expect(result.nota_final).toBe(8.8);
  });
});
