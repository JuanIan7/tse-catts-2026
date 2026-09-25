import { describe, expect, it } from "vitest";
import { calculateEvaluation, testSubmission } from "./scoring";

describe("motor de pontuação TSE v0.3", () => {
  it("mantém os quatro cenários de autoteste do motor original", () => {
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
    rounding.itens.ouviu_atentamente_postura = { estado: "parcial", evidencia: "teste" };
    rounding.itens.fator_principal = { estado: "compreendeu_com_deslizes_leves", evidencia: "teste" };
    const result = calculateEvaluation(rounding);
    expect(result.nota_bruta).toBe(9.25);
    expect(result.nota_final).toBe(9.3);
  });
});
