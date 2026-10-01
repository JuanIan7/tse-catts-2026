import { describe, expect, it } from "vitest";
import { existingRecalculatedEmailMessage, recalculatedEmailFailureMessage } from "./recalculated-email-delivery";

describe("recalculated email delivery messages", () => {
  it("bloqueia uma segunda tentativa enquanto a primeira reserva está pendente", () => {
    expect(existingRecalculatedEmailMessage({ claimed: false, status: "PENDING", recipient: "aluno@example.com", sent_at: null, created_at: new Date().toISOString(), recalculated_score: 9 }))
      .toBe("Já existe um envio em andamento para esta nota. Aguarde alguns segundos e atualize a página.");
  });

  it("mantém bloqueada uma pendência antiga cujo resultado não pôde ser confirmado", () => {
    expect(existingRecalculatedEmailMessage({
      claimed: false,
      status: "PENDING",
      recipient: "aluno@example.com",
      sent_at: null,
      created_at: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
      recalculated_score: 9,
    })).toBe("Não foi possível confirmar o resultado do envio. Consulte o histórico do provedor antes de iniciar outro recálculo.");
  });

  it("identifica uma nota já enviada sem revelar detalhes internos", () => {
    expect(existingRecalculatedEmailMessage({ claimed: false, status: "SENT", recipient: "aluno@example.com", sent_at: "2026-10-01T17:00:00.000Z", created_at: "2026-10-01T16:59:00.000Z", recalculated_score: 9 }))
      .toMatch(/^A nota já foi enviada para aluno@example.com em /);
  });

  it("preserva somente mensagens de configuração seguras", () => {
    expect(recalculatedEmailFailureMessage("Configuração do Brevo incompleta. Cadastre BREVO_API_KEY e BREVO_FROM."))
      .toBe("Configuração do Brevo incompleta. Cadastre BREVO_API_KEY e BREVO_FROM.");
    expect(recalculatedEmailFailureMessage("O Resend recusou o envio: detalhe interno"))
      .toBe("O serviço de e-mail não aceitou o envio. Verifique o remetente configurado e tente novamente.");
  });
});
