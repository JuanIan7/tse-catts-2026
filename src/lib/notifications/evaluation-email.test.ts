import { afterEach, describe, expect, it, vi } from "vitest";
import { sendMailWithProviders } from "./email-delivery";

afterEach(() => vi.unstubAllGlobals());

describe("sendMailWithProviders", () => {
  it("prioriza o Brevo quando sua chave e remetente estão configurados", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messageId: "message" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendMailWithProviders(
      { to: "aluno@example.com", subject: "Nota", text: "Sua nota foi atualizada." },
      { brevoKey: "brevo-key", brevoFrom: "TSE - CATTS <juanhanzi@gmail.com>", resendKey: "resend-key", resendFrom: "CATTS <onboarding@resend.dev>" },
    );

    expect(result).toEqual({ sent: true, reason: null, confirmedNotSent: false });
    expect(fetchMock).toHaveBeenCalledWith("https://api.brevo.com/v3/smtp/email", expect.objectContaining({
      headers: expect.objectContaining({ "api-key": "brevo-key" }),
      body: JSON.stringify({ sender: { name: "TSE - CATTS", email: "juanhanzi@gmail.com" }, to: [{ email: "aluno@example.com" }], subject: "Nota", textContent: "Sua nota foi atualizada." }),
    }));
  });

  it("envia a mesma chave de idempotência aos provedores", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messageId: "message" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendMailWithProviders(
      { to: "aluno@example.com", subject: "Nota", text: "Mensagem.", idempotencyKey: "75fdc2f2-a234-4a1c-a93e-5f9660627949" },
      { brevoKey: "brevo-key", brevoFrom: "TSE - CATTS <juanhanzi@gmail.com>" },
    );

    expect(fetchMock).toHaveBeenCalledWith("https://api.brevo.com/v3/smtp/email", expect.objectContaining({
      body: expect.stringContaining('"idempotencyKey":"75fdc2f2-a234-4a1c-a93e-5f9660627949"'),
    }));

    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "message" }), { status: 200 }));
    await sendMailWithProviders(
      { to: "aluno@example.com", subject: "Nota", text: "Mensagem.", idempotencyKey: "75fdc2f2-a234-4a1c-a93e-5f9660627949" },
      { resendKey: "resend-key", resendFrom: "CATTS <onboarding@resend.dev>" },
    );

    expect(fetchMock).toHaveBeenLastCalledWith("https://api.resend.com/emails", expect.objectContaining({
      headers: expect.objectContaining({ "Idempotency-Key": "75fdc2f2-a234-4a1c-a93e-5f9660627949" }),
    }));
  });

  it("mantém o Resend como alternativa enquanto o Brevo não está configurado", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "message" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendMailWithProviders(
      { to: "juanhanzi@gmail.com", subject: "Teste", text: "Mensagem." },
      { resendKey: "resend-key", resendFrom: "CATTS <onboarding@resend.dev>" },
    );

    expect(fetchMock).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer resend-key" }) }));
  });

  it("não usa o Resend quando a configuração do Brevo está incompleta", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendMailWithProviders(
      { to: "aluno@example.com", subject: "Nota", text: "Mensagem." },
      { brevoKey: "brevo-key", resendKey: "resend-key", resendFrom: "CATTS <onboarding@resend.dev>" },
    );

    expect(result).toEqual({ sent: false, reason: "Configuração do Brevo incompleta. Cadastre BREVO_API_KEY e BREVO_FROM.", confirmedNotSent: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mantém uma recusa HTTP 400 como resultado não confirmado", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Remetente inválido\r\ndetalhe interno" }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendMailWithProviders(
      { to: "aluno@example.com", subject: "Nota", text: "Mensagem." },
      { brevoKey: "brevo-key", brevoFrom: "TSE - CATTS <juanhanzi@gmail.com>", resendKey: "resend-key", resendFrom: "CATTS <onboarding@resend.dev>" },
    );

    expect(result).toEqual({ sent: false, reason: "O Brevo recusou o envio: Remetente inválido detalhe interno", confirmedNotSent: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://api.brevo.com/v3/smtp/email", expect.anything());
  });

  it("retorna um erro estável quando não consegue conectar ao Brevo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));

    const result = await sendMailWithProviders(
      { to: "aluno@example.com", subject: "Nota", text: "Mensagem." },
      { brevoKey: "brevo-key", brevoFrom: "TSE - CATTS <juanhanzi@gmail.com>" },
    );

    expect(result).toEqual({ sent: false, reason: "Não foi possível conectar ao Brevo.", confirmedNotSent: false });
  });

  it("não classifica uma falha temporária como rejeição confirmada", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Tente novamente" }), { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendMailWithProviders(
      { to: "aluno@example.com", subject: "Nota", text: "Mensagem." },
      { brevoKey: "brevo-key", brevoFrom: "TSE - CATTS <juanhanzi@gmail.com>" },
    );

    expect(result).toEqual({ sent: false, reason: "O Brevo recusou o envio: Tente novamente", confirmedNotSent: false });
  });

  it("confirma o envio idempotente quando uma falha de rede é seguida por chave duplicada", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: "duplicate_parameter" }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const mail = { to: "aluno@example.com", subject: "Nota", text: "Mensagem.", idempotencyKey: "75fdc2f2-a234-4a1c-a93e-5f9660627949" };
    const config = { brevoKey: "brevo-key", brevoFrom: "TSE - CATTS <juanhanzi@gmail.com>" };

    const timedOut = await sendMailWithProviders(mail, config);
    const duplicateKey = await sendMailWithProviders(mail, config);

    expect(timedOut).toEqual({ sent: false, reason: "Não foi possível conectar ao Brevo.", confirmedNotSent: false });
    expect(duplicateKey).toEqual({ sent: true, reason: null, confirmedNotSent: false });
  });
});
