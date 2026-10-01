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

    expect(result).toEqual({ sent: true, reason: null });
    expect(fetchMock).toHaveBeenCalledWith("https://api.brevo.com/v3/smtp/email", expect.objectContaining({
      headers: expect.objectContaining({ "api-key": "brevo-key" }),
      body: JSON.stringify({ sender: { name: "TSE - CATTS", email: "juanhanzi@gmail.com" }, to: [{ email: "aluno@example.com" }], subject: "Nota", textContent: "Sua nota foi atualizada." }),
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

  it("retorna um erro seguro quando o Brevo recusa a mensagem sem acionar o Resend", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Remetente inválido\r\ndetalhe interno" }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendMailWithProviders(
      { to: "aluno@example.com", subject: "Nota", text: "Mensagem." },
      { brevoKey: "brevo-key", brevoFrom: "TSE - CATTS <juanhanzi@gmail.com>", resendKey: "resend-key", resendFrom: "CATTS <onboarding@resend.dev>" },
    );

    expect(result).toEqual({ sent: false, reason: "O Brevo recusou o envio: Remetente inválido detalhe interno" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://api.brevo.com/v3/smtp/email", expect.anything());
  });

  it("retorna um erro estável quando não consegue conectar ao Brevo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));

    const result = await sendMailWithProviders(
      { to: "aluno@example.com", subject: "Nota", text: "Mensagem." },
      { brevoKey: "brevo-key", brevoFrom: "TSE - CATTS <juanhanzi@gmail.com>" },
    );

    expect(result).toEqual({ sent: false, reason: "Não foi possível conectar ao Brevo." });
  });
});
