import { describe, expect, it } from "vitest";
import { povPrompt } from "./pov-prompt";

describe("povPrompt", () => {
  it("restringe a imagem ao briefing observável e aos limites de segurança", () => {
    const prompt = povPrompt({ titulo: "x", dificuldade: "MEDIA", contexto_observavel: "praça", observaveis_iniciais: ["pessoa silenciosa"], orientacao: "x" });
    expect(prompt).toContain("pessoa silenciosa"); expect(prompt).toContain("Never depict or imply method"); expect(prompt).toContain("no text");
  });
});
