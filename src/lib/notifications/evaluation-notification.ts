import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { adminNotificationAddress, sendEvaluationEmail } from "./evaluation-email";

export async function notifyEvaluationCompleted(input: { sessionId: string; userId: string; finalScore: number }) {
  try {
    const admin = createSupabaseAdminClient();
    const recipient = adminNotificationAddress();
    const { data: profile } = await admin.from("profiles").select("display_name").eq("user_id", input.userId).maybeSingle();
    const mail = await sendEvaluationEmail({ to: recipient, subject: "CATTS — abordagem finalizada para revisão", text: `${profile?.display_name ?? "Aluno"} concluiu uma abordagem com nota ${input.finalScore.toFixed(1)} / 10. Revise no painel administrativo.` });
    await admin.from("evaluation_notification_log").insert({ session_id: input.sessionId, kind: "ADMIN_FINISHED", recipient, status: mail.sent ? "SENT" : mail.reason?.includes("pendente") ? "PENDING" : "FAILED", error_message: mail.reason });
  } catch { /* O aviso não pode afetar a simulação. */ }
}
