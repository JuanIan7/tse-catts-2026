import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { acceptDignifiedExit, readDidacticState, recordInterruption } from "./didactic-state";
import { finalizeTrainingSession } from "./conversation";

type Session = { id: string; user_id: string; status: string; didactic_state: unknown; didactic_state_revision: number };
type Turn = { id: string; speaker: string; delivery_status: string; event_metadata: Record<string, unknown> | null };

async function saveState(session: Session, state: unknown) {
  const next = readDidacticState(state);
  next.revision = session.didactic_state_revision + 1;
  const { error } = await createSupabaseAdminClient().rpc("save_training_didactic_state", { p_session_id: session.id, p_expected_revision: session.didactic_state_revision, p_state: next });
  if (error) throw new Error("A sessão foi atualizada em outra conexão. Atualize a página antes de continuar.");
}

export async function confirmDeliveredTurn(input: { userId: string; sessionId: string; turnId: string; interrupted: boolean }) {
  const admin = createSupabaseAdminClient();
  const [{ data: rawSession }, { data: rawTurn }] = await Promise.all([
    admin.from("training_sessions").select("id, user_id, status, didactic_state, didactic_state_revision").eq("id", input.sessionId).maybeSingle(),
    admin.from("training_transcripts").select("id, speaker, delivery_status, event_metadata").eq("id", input.turnId).eq("session_id", input.sessionId).maybeSingle(),
  ]);
  const session = rawSession as Session | null;
  const turn = rawTurn as Turn | null;
  if (!session || session.user_id !== input.userId) throw new Error("Ocorrência indisponível.");
  if (!turn || turn.speaker !== "PERSONAGEM") throw new Error("Resposta de voz indisponível.");
  if (turn.delivery_status === "OUVIDO" || turn.delivery_status === "INTERROMPIDO") return { completed: session.status === "ENCERRADA_COM_EXITO" };
  if (turn.delivery_status !== "PENDENTE") throw new Error("Esta resposta não pode mais ser confirmada.");

  if (input.interrupted) {
    const { error: turnError } = await admin.from("training_transcripts").update({ delivery_status: "INTERROMPIDO" }).eq("id", turn.id).eq("delivery_status", "PENDENTE");
    if (turnError) throw new Error("Não foi possível registrar a interrupção.");
    const { error: eventError } = await admin.rpc("append_training_transcript", {
      p_session_id: session.id, p_speaker: "SISTEMA", p_content: "Fala do tentante interrompida pelo abordador.", p_source: "SISTEMA", p_delivery_status: "OUVIDO", p_event_metadata: { event: "INTERRUPCAO", interrupted_turn_id: turn.id },
    });
    if (eventError) throw new Error("A interrupção foi detectada, mas não pôde ser registrada.");
    await saveState(session, recordInterruption(readDidacticState(session.didactic_state)));
    return { completed: false };
  }

  const { error } = await admin.from("training_transcripts").update({ delivery_status: "OUVIDO" }).eq("id", turn.id).eq("delivery_status", "PENDENTE");
  if (error) throw new Error("Não foi possível confirmar a entrega da resposta.");
  if (turn.event_metadata?.finish_after_delivery !== true) return { completed: false };
  await saveState(session, acceptDignifiedExit(readDidacticState(session.didactic_state)));
  return finalizeTrainingSession(input);
}
