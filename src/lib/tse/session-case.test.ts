import { describe, expect, it } from "vitest";
import { briefingNarration, createSessionCase, openingCharacterLine } from "./session-case";

describe("createSessionCase", () => {
  it("preserva a estrutura pedagógica mínima e só expõe briefing observável", () => {
    const { internalCase, publicBriefing } = createSessionCase("MEDIA", () => 0);
    expect(internalCase.fator_principal).toBeTruthy();
    expect(internalCase.fatores_risco).toHaveLength(3);
    expect(internalCase.fatores_protecao).toHaveLength(3);
    expect(internalCase.ocultas.length).toBeGreaterThan(0);
    expect(internalCase.voz_personagem.apresentacao).toMatch(/MASCULINA|FEMININA/);
    expect(publicBriefing.observaveis_iniciais.length).toBeGreaterThanOrEqual(2);
    expect(publicBriefing.acionamento.length).toBeGreaterThan(20);
    expect(publicBriefing.informacoes_recebidas.length).toBeGreaterThanOrEqual(2);
    expect(briefingNarration(publicBriefing)).toContain(publicBriefing.acionamento);
    expect(briefingNarration(publicBriefing)).toContain(publicBriefing.contexto_observavel);
    expect(JSON.stringify(publicBriefing)).not.toContain(internalCase.ocultas[0]);
  });

  it("sorteia três perfis com aberturas distintas, sem expor o rótulo no briefing", () => {
    const depressivo = createSessionCase("MEDIA", () => 0);
    const agressivo = createSessionCase("MEDIA", () => 0.12);
    const psicotico = createSessionCase("MEDIA", () => 0.23);
    expect([depressivo.internalCase.perfil_tipo, agressivo.internalCase.perfil_tipo, psicotico.internalCase.perfil_tipo]).toEqual(["DEPRESSIVO", "AGRESSIVO", "PSICOTICO"]);
    expect(openingCharacterLine(depressivo.internalCase)).toContain("não quero conversar");
    expect(openingCharacterLine(agressivo.internalCase)).toContain("caralho");
    expect(openingCharacterLine(psicotico.internalCase)).toContain("porta");
    expect(JSON.stringify(psicotico.publicBriefing)).not.toContain("PSICOTICO");
  });

  it("evita títulos usados recentemente quando há alternativas", () => {
    const first = createSessionCase("MEDIA", () => 0);
    const next = createSessionCase("MEDIA", () => 0, [first.publicBriefing.titulo]);
    expect(next.publicBriefing.titulo).not.toBe(first.publicBriefing.titulo);
  });
});
