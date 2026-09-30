import { describe, expect, it } from "vitest";
import { appealStatusFor } from "./evaluation-appeal";

describe("situação do recurso", () => {
  it("mantém pendente enquanto existir item sem decisão", () => {
    expect(appealStatusFor(["ACEITO", "PENDENTE"])).toBe("PENDENTE");
  });

  it("distingue recurso aceito, rejeitado e parcial", () => {
    expect(appealStatusFor(["ACEITO", "ACEITO"])).toBe("ACEITO");
    expect(appealStatusFor(["REJEITADO"])).toBe("REJEITADO");
    expect(appealStatusFor(["ACEITO", "REJEITADO"])).toBe("PARCIAL");
  });
});
