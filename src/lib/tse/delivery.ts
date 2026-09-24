import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { finalizeTrainingSession } from "./conversation";

type Session = { id: string; user_id: string; status: string };
type DeliveryResult = { changed: boolean; finish_after_delivery: boolean };

export async function confirmDeliveredTurn(input: { userId: string; sessionId: string; turnId: string; interrupted: boolean }) {
  const admin = createSupabaseAdminClient();
  const { data: rawSession } = await admin
    .from("training_sessions")
    .select("id, user_id, status")
    .eq("id", input.sessionId)
    .maybeSingle();
  const session = rawSession as Session | null;
  if (!session || session.user_id !== input.userId) throw new Error("Ocorrência indisponível.");

  const { data, error } = await admin.rpc("confirm_voice_delivery", {
    p_session_id: input.sessionId,
    p_turn_id: input.turnId,
    p_interrupted: input.interrupted,
  });
  if (error) throw new Error("Não foi possível confirmar a entrega da resposta.");
  const result = Array.isArray(data) ? data[0] as DeliveryResult | undefined : data as DeliveryResult | null;
  if (!result) throw new Error("Não foi possível confirmar a entrega da resposta.");
  if (input.interrupted || !result.finish_after_delivery) return { completed: false, changed: result.changed };
  return { ...(await finalizeTrainingSession({ userId: input.userId, sessionId: input.sessionId })), changed: result.changed };
}
