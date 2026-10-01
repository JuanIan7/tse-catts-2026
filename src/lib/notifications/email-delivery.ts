export type Mail = { to: string; subject: string; text: string };

type Sender = { name: string; email: string };
type MailProviderConfig = { brevoKey?: string; brevoFrom?: string; resendKey?: string; resendFrom?: string };

function senderFrom(value: string | undefined): Sender | null {
  if (!value) return null;
  const match = value.trim().match(/^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/);
  if (match) return { name: match[1].trim() || "CATTS", email: match[2] };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return { name: "CATTS", email: value.trim() };
  return null;
}

async function failedProviderResponse(provider: string, response: Response) {
  const detail = await response.json().catch(() => null) as { message?: unknown; name?: unknown; code?: unknown } | null;
  const sanitize = (value: string, limit: number) => value.replace(/[\r\n]+/g, " ").slice(0, limit);
  const message = typeof detail?.message === "string"
    ? sanitize(detail.message, 220)
    : typeof detail?.name === "string"
      ? sanitize(detail.name, 120)
      : typeof detail?.code === "string"
        ? sanitize(detail.code, 120)
        : `HTTP ${response.status}`;
  return { sent: false, reason: `O ${provider} recusou o envio: ${message}` } as const;
}

async function sendWithBrevo(mail: Mail, key: string, sender: Sender) {
  let response: Response;
  try {
    response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ sender, to: [{ email: mail.to }], subject: mail.subject, textContent: mail.text }),
    });
  } catch {
    return { sent: false, reason: "Não foi possível conectar ao Brevo." } as const;
  }
  if (!response.ok) return failedProviderResponse("Brevo", response);
  return { sent: true, reason: null } as const;
}

async function sendWithResend(mail: Mail, key: string, from: string) {
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: mail.to, subject: mail.subject, text: mail.text }) });
  } catch {
    return { sent: false, reason: "Não foi possível conectar ao provedor de e-mail." } as const;
  }
  if (!response.ok) return failedProviderResponse("provedor de e-mail", response);
  return { sent: true, reason: null } as const;
}

export async function sendMailWithProviders(mail: Mail, config: MailProviderConfig) {
  const brevoSender = senderFrom(config.brevoFrom);
  if (config.brevoKey && brevoSender) return sendWithBrevo(mail, config.brevoKey, brevoSender);
  if (config.resendKey && config.resendFrom) return sendWithResend(mail, config.resendKey, config.resendFrom);
  return { sent: false, reason: "Configuração de e-mail pendente. Cadastre BREVO_API_KEY e BREVO_FROM." } as const;
}
