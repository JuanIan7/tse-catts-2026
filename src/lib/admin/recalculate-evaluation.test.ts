import { describe, expect, it } from "vitest";
import { recalculateEvaluationFromAnnotations } from "./recalculate-evaluation";
import type { AnnotationType } from "./evaluation-review";
import { calculateEvaluation, testSubmission } from "../tse/scoring";

const item = (id: string) => ({ id, estado: id === "tom_de_voz" ? "nao_observavel" : id === "fatores_protecao" || id === "fatores_risco" || id === "fator_principal" ? "nao_encontrou" : "nao_feito", evidencia: "Sem evidência registrada." });
const base = { parcial: false, itens: ["aproximacao_calma_silenciosa", "silencio_inicial", "apresentacao_pessoal", "respeitou_pausas_silenciosas", "ouviu_atentamente_postura", "espaco_para_desabafo", "tom_de_voz", "perguntas_simples_complexas", "parafrase_resumida", "memoria_linkada", "maieutica_ou_teia", "desistencia_ou_saida_digna", "dominou_dialogo", "conduziu_solucao", "fatores_protecao", "fatores_risco", "fator_principal"].map(item), erros_graves: {}, ficha_caso: { fatores_protecao: ["filha", "amigo"], fatores_risco: ["luto"] } };
const annotation = (annotationType: AnnotationType) => ({ id: annotationType, sessionId: "s", transcriptId: "t", annotationType, startOffset: 0, endOffset: 2, selectedText: "ok", note: null });

describe("recalculateEvaluationFromAnnotations", () => {
  it("credita ferramentas confirmadas e calcula fatores proporcionalmente", () => {
    const result = recalculateEvaluationFromAnnotations(base, [annotation("PERGUNTA_SIMPLES"), annotation("PERGUNTA_COMPLEXA"), annotation("PARAFRASE"), annotation("FATOR_PROTECAO"), annotation("FATOR_RISCO")]);
    expect(result.itens.find((entry) => entry.id === "perguntas_simples_complexas")?.ajuste).toBe(1);
    expect(result.itens.find((entry) => entry.id === "parafrase_resumida")?.ajuste).toBe(1);
    expect(result.itens.find((entry) => entry.id === "fatores_protecao")?.ajuste).toBe(0.5);
    expect(result.itens.find((entry) => entry.id === "fatores_risco")?.ajuste).toBe(1);
    expect(result.nota_final).toBe(3.8);
  });

  it("recalcula avaliações armazenadas com itens automáticos de 0,1", () => {
    const calculated = calculateEvaluation(testSubmission("best"));

    const result = recalculateEvaluationFromAnnotations(calculated, []);

    expect(result.nota_final).toBe(calculated.nota_final);
    expect(result.itens.find((entry) => entry.id === "aproximacao_calma_silenciosa")?.ajuste).toBe(0.1);
  });

  it("aplica diretamente domínio e solução aceitos em recurso", () => {
    const result = recalculateEvaluationFromAnnotations(base, [annotation("DOMINOU_DIALOGO"), annotation("CONDUZIU_SOLUCAO")]);
    expect(result.itens.find((entry) => entry.id === "dominou_dialogo")?.ajuste).toBe(0.3);
    expect(result.itens.find((entry) => entry.id === "conduziu_solucao")?.ajuste).toBe(1);
  });
});
