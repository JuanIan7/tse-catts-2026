import { describe, expect, it } from "vitest";
import { isPersonalPresentation } from "./personal-presentation";

describe("apresentação pessoal", () => {
  it("reconhece nome próprio e Corpo de Bombeiro no mesmo turno", () => {
    expect(isPersonalPresentation("Eu sou o Tiago do Corpo de Bombeiro. Eu estou aqui para te ouvir.")).toBe(true);
    expect(isPersonalPresentation("Meu nome é Ana, do Corpo de Bombeiros.")).toBe(true);
  });

  it("não atribui apresentação quando falta o nome ou a instituição", () => {
    expect(isPersonalPresentation("Sou do Corpo de Bombeiros e estou aqui para ouvir.")).toBe(false);
    expect(isPersonalPresentation("Eu sou o Tiago e quero conversar.")).toBe(false);
  });
});
