import { describe, expect, it } from "vitest";
import { normalizePublicBriefing } from "./briefing";

describe("normalizePublicBriefing", () => {
  it("mantém sessões antigas utilizáveis com um briefing completo", () => {
    const briefing = normalizePublicBriefing({
      titulo: "Ocorrência antiga",
      contexto_observavel: "Pessoa em local público.",
      observaveis_iniciais: ["permanece em silêncio"],
      orientacao: "Conduza com calma.",
    }, "MEDIA");

    expect(briefing.titulo).toBe("Ocorrência antiga");
    expect(briefing.acionamento).toBeTruthy();
    expect(briefing.informacoes_recebidas.length).toBeGreaterThan(0);
    expect(briefing.condicoes_da_cena.length).toBeGreaterThan(0);
  });
});
