import { describe, expect, it } from "vitest";
import { briefingNarration, createSessionCase } from "./session-case";

describe("createSessionCase", () => {
  it("preserva a estrutura pedagógica mínima e só expõe briefing observável", () => {
    const { internalCase, publicBriefing } = createSessionCase("MEDIA", () => 0);
    expect(internalCase.fator_principal).toBeTruthy();
    expect(internalCase.fatores_risco).toHaveLength(3);
    expect(internalCase.fatores_protecao).toHaveLength(3);
    expect(internalCase.ocultas.length).toBeGreaterThan(0);
    expect(publicBriefing.observaveis_iniciais.length).toBeGreaterThanOrEqual(2);
    expect(publicBriefing.acionamento.length).toBeGreaterThan(20);
    expect(publicBriefing.informacoes_recebidas.length).toBeGreaterThanOrEqual(2);
    expect(briefingNarration(publicBriefing)).toContain(publicBriefing.acionamento);
    expect(briefingNarration(publicBriefing)).toContain(publicBriefing.contexto_observavel);
    expect(JSON.stringify(publicBriefing)).not.toContain(internalCase.ocultas[0]);
  });
});
