import "server-only";

type Mail = { to: string; subject: string; text: string };

export async function sendEvaluationEmail(mail: Mail) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;
  if (!key || !from) return { sent: false, reason: "Configuração de e-mail pendente." };
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: mail.to, subject: mail.subject, text: mail.text }) });
  if (!response.ok) return { sent: false, reason: "O provedor de e-mail recusou o envio." };
  return { sent: true, reason: null };
}

export const adminNotificationAddress = () => process.env.ADMIN_NOTIFICATION_EMAIL || "juanhanzi@gmail.com";
