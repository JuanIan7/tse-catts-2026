import { describe, expect, it } from "vitest";
import { appealSenderFor, appealStatusFor } from "./evaluation-appeal";

describe("situação do recurso", () => {
  it("mantém pendente enquanto existir item sem decisão", () => {
    expect(appealStatusFor(["ACEITO", "PENDENTE"])).toBe("PENDENTE");
  });

  it("distingue recurso aceito, rejeitado e parcial", () => {
    expect(appealStatusFor(["ACEITO", "ACEITO"])).toBe("ACEITO");
    expect(appealStatusFor(["REJEITADO"])).toBe("REJEITADO");
    expect(appealStatusFor(["ACEITO", "REJEITADO"])).toBe("PARCIAL");
  });

  it("mantém o remetente de cada recurso isolado e usa fallback sem conta", () => {
    const senders = new Map([
      ["aluno-a", { name: "Ana", email: "ana@exemplo.com" }],
      ["aluno-b", { name: "Bruno", email: "bruno@exemplo.com" }],
    ]);

    expect(appealSenderFor("aluno-a", senders)).toEqual({ name: "Ana", email: "ana@exemplo.com" });
    expect(appealSenderFor("aluno-b", senders)).toEqual({ name: "Bruno", email: "bruno@exemplo.com" });
    expect(appealSenderFor("sem-conta", senders)).toEqual({ name: "Aluno", email: "E-mail não informado" });
  });
});
