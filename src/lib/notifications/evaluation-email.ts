import "server-only";
import { sendMailWithProviders, type Mail } from "./email-delivery";

export async function sendEvaluationEmail(mail: Mail) {
  return sendMailWithProviders(mail, {
    brevoKey: process.env.BREVO_API_KEY,
    brevoFrom: process.env.BREVO_FROM,
    resendKey: process.env.RESEND_API_KEY,
    resendFrom: process.env.RESEND_FROM,
  });
}

export const adminNotificationAddress = () => process.env.ADMIN_NOTIFICATION_EMAIL || "juanhanzi@gmail.com";
