import { describe, expect, it } from "vitest";
import { openAIErrorMessage } from "./openai-error";

describe("openAIErrorMessage", () => {
  it("identifica saldo esgotado sem expor o erro técnico ao aluno", () => {
    expect(openAIErrorMessage({ status: 429, error: { code: "credit_balance_exhausted" } }, "responder")).toContain("sem créditos");
  });

  it("distingue limite temporário de saldo esgotado", () => {
    const message = openAIErrorMessage({ status: 429, error: { code: "rate_limit_exceeded" } }, "responder");
    expect(message).toContain("limite temporário");
    expect(message).not.toContain("sem créditos");
  });
});
