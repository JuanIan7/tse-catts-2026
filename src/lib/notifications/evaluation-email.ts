import "server-only";
import { configuredMailProvider, sendMailWithProviders, type Mail } from "./email-delivery";

const evaluationEmailConfig = () => ({
  brevoKey: process.env.BREVO_API_KEY,
  brevoFrom: process.env.BREVO_FROM,
  resendKey: process.env.RESEND_API_KEY,
  resendFrom: process.env.RESEND_FROM,
});

export async function sendEvaluationEmail(mail: Mail) {
  return sendMailWithProviders(mail, evaluationEmailConfig());
}

export const evaluationMailProvider = () => configuredMailProvider(evaluationEmailConfig());

export const adminNotificationAddress = () => process.env.ADMIN_NOTIFICATION_EMAIL || "juanhanzi@gmail.com";
