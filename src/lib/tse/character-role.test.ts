import { describe, expect, it } from "vitest";
import { hasCharacterRoleInversion } from "./character-role";

describe("papel do personagem", () => {
  it("bloqueia perguntas de acolhimento dirigidas ao abordador", () => {
    expect(hasCharacterRoleInversion("O foco aqui é você. O que está passando pela sua mente?")).toBe(true);
    expect(hasCharacterRoleInversion("Você se sente seguro onde mora?")).toBe(true);
    expect(hasCharacterRoleInversion("Onde você mora? Como você se sente?")).toBe(true);
    expect(hasCharacterRoleInversion("Qual e o seu trabalho? O que voce pensa disso?")).toBe(true);
  });

  it("permite resistência do tentante sobre a própria situação", () => {
    expect(hasCharacterRoleInversion("Não quero falar sobre isso agora. Está tudo muito confuso para mim.")).toBe(false);
  });
});
