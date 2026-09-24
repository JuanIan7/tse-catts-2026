import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { respondAsCharacter } from "./character";
import { acceptDignifiedExit, applyDidacticSignals, calculateDidacticEvaluation, readDidacticState, recordInterruption } from "./didactic-state";
import type { InternalCase } from "./session-case";

type Speaker = "ALUNO" | "PERSONAGEM" | "NARRADOR" | "SISTEMA";
type Source = "TEXTO" | "VOZ" | "SISTEMA";
type DeliveryStatus = "PENDENTE" | "OUVIDO" | "INTERROMPIDO";
type TranscriptTurn = { speaker: Speaker; content: string };
type SessionRecord = { id: string; user_id: string; status: string; didactic_state: unknown; didactic_state_revision: number };
type CharacterTurn = { id: string; sequence_number: number };
const activeStatuses = new Set(["CRIADA", "EM_ANDAMENTO", "RECONEXAO"]);
const terminalStatuses = new Set(["ENCERRADA_COM_EXITO", "ENCERRADA_SEM_EXITO", "CANCELADA"]);

async function appendTranscript(sessionId: string, speaker: Speaker, content: string, source: Source, deliveryStatus: DeliveryStatus, eventMetadata: Record<string, unknown> = {}) {
  const { data, error } = await createSupabaseAdminClient().rpc("append_training_transcript", { p_session_id: sessionId, p_speaker: speaker, p_content: content, p_source: source, p_delivery_status: deliveryStatus, p_event_metadata: eventMetadata });
  if (error || !data) throw new Error("Não foi possível registrar a conversa.");
  return data as CharacterTurn;
}

async function transition(sessionId: string, next: string) {
  const { error } = await createSupabaseAdminClient().rpc("transition_training_session", { p_session_id: sessionId, p_next: next });
  if (error) throw new Error("Não foi possível atualizar o estado da ocorrência.");
}

async function transitionToActive(session: SessionRecord) {
  if (session.status === "CRIADA" || session.status === "RECONEXAO") await transition(session.id, "EM_ANDAMENTO");
}

async function persistDidacticState(session: SessionRecord, nextState: unknown) {
  const state = readDidacticState(nextState);
  state.revision = session.didactic_state_revision + 1;
  const { error } = await createSupabaseAdminClient().rpc("save_training_didactic_state", { p_session_id: session.id, p_expected_revision: session.didactic_state_revision, p_state: state });
  if (error) throw new Error("A sessão foi atualizada em outra conexão. Atualize a página e tente novamente.");
  return state;
}

async function getOwnedSession(userId: string, sessionId: string) {
  const { data } = await createSupabaseAdminClient().from("training_sessions").select("id, user_id, status, didactic_state, didactic_state_revision").eq("id", sessionId).maybeSingle();
  const session = data as SessionRecord | null;
  if (!session || session.user_id !== userId) throw new Error("Ocorrência indisponível.");
  return session;
}

export async function finalizeTrainingSession(input: { userId: string; sessionId: string }) {
  const session = await getOwnedSession(input.userId, input.sessionId);
  if (terminalStatuses.has(session.status)) return { completed: true };
  const state = readDidacticState(session.didactic_state);
  if (!state.saida_digna_aceita) return { completed: false };
  if (session.status !== "AVALIACAO_PENDENTE") await transition(session.id, "AVALIACAO_PENDENTE");
  const calculation = calculateDidacticEvaluation(state);
  const { error: evaluationError } = await createSupabaseAdminClient().from("evaluations").upsert({
    session_id: session.id, user_id: input.userId, partial: calculation.parcial, result: "EXITO", rubric_version: "0.3", item_states: calculation.itens, grave_errors: calculation.erros_graves, calculation, final_score: calculation.nota_final,
  }, { onConflict: "session_id" });
  if (evaluationError) throw new Error("Não foi possível preparar a avaliação automática.");
  await transition(session.id, "ENCERRADA_COM_EXITO");
  return { completed: true };
}

export async function recordStudentTurn(input: { userId: string; sessionId: string; content: string; source: "TEXTO" | "VOZ" }) {
  const content = input.content.trim();
  if (!content || content.length > 1500) throw new Error("Envie uma fala entre 1 e 1500 caracteres.");
  const session = await getOwnedSession(input.userId, input.sessionId);
  if (!activeStatuses.has(session.status)) throw new Error("Ocorrência indisponível.");
  const didacticState = readDidacticState(session.didactic_state);
  if (didacticState.turnos >= 40) throw new Error("Esta simulação atingiu o limite de 40 turnos. Inicie uma nova ocorrência para continuar treinando.");
  const admin = createSupabaseAdminClient();
  const { data: rawHistory } = await admin.from("training_transcripts").select("speaker, content, created_at").eq("session_id", input.sessionId).eq("delivery_status", "OUVIDO").order("sequence_number", { ascending: false }).limit(8);
  const newestStudentTurn = (rawHistory ?? []).find((turn) => turn.speaker === "ALUNO");
  if (newestStudentTurn && Date.now() - new Date(newestStudentTurn.created_at).getTime() < 2000) throw new Error("Aguarde dois segundos antes de enviar outra fala.");
  const history = (rawHistory ?? []).reverse().map((turn) => ({ speaker: turn.speaker as Speaker, content: turn.content })) as TranscriptTurn[];
  const { data: secret } = await admin.from("training_session_secrets").select("internal_case").eq("session_id", input.sessionId).maybeSingle();
  if (!secret) throw new Error("Ficha pedagógica indisponível.");

  await transitionToActive(session);
  await appendTranscript(input.sessionId, "ALUNO", content, input.source, "OUVIDO");
  const character = await respondAsCharacter(secret.internal_case as InternalCase, [...history, { speaker: "ALUNO", content }], didacticState);
  const deliveryStatus: DeliveryStatus = input.source === "VOZ" ? "PENDENTE" : "OUVIDO";
  const characterTurn = await appendTranscript(input.sessionId, "PERSONAGEM", character.fala, "SISTEMA", deliveryStatus, { finish_after_delivery: character.aceita_saida_digna });
  const nextState = applyDidacticSignals(didacticState, {
    rapport_delta: character.rapport_delta,
    categorias_reveladas: character.categorias_reveladas,
    evidencias: character.evidencias,
    // Erros graves exigem revisão humana na beta; nunca são deduzidos apenas por inferência do modelo.
    erros_graves: [],
    acceptsExit: input.source === "TEXTO" && character.aceita_saida_digna,
  });
  await persistDidacticState(session, nextState);
  const completed = input.source === "TEXTO" && character.aceita_saida_digna ? (await finalizeTrainingSession({ userId: input.userId, sessionId: input.sessionId })).completed : false;
  return { characterTurnId: characterTurn.id, characterText: character.fala, pendingAudio: deliveryStatus === "PENDENTE", completed };
}

export async function confirmCharacterDelivery(input: { userId: string; sessionId: string; turnId: string; interrupted: boolean }) {
  const session = await getOwnedSession(input.userId, input.sessionId);
  const admin = createSupabaseAdminClient();
  const { data: rawTurn } = await admin.from("training_transcripts").select("id, speaker, delivery_status, event_metadata").eq("id", input.turnId).eq("session_id", input.sessionId).maybeSingle();
  const turn = rawTurn as { id: string; speaker: Speaker; delivery_status: DeliveryStatus; event_metadata: Record<string, unknown> } | null;
  if (!turn || turn.speaker !== "PERSONAGEM" || turn.delivery_status !== "PENDENTE") throw new Error("Resposta de voz indisponível.");
  if (input.interrupted) {
    const { error } = await admin.from("training_transcripts").update({ speaker: "SISTEMA", content: "Resposta do tentante interrompida antes da conclusão.", delivery_status: "INTERROMPIDO", event_metadata: { event: "INTERRUPCAO" } }).eq("id", input.turnId);
    if (error) throw new Error("Não foi possível registrar a interrupção.");
    await persistDidacticState(session, recordInterruption(readDidacticState(session.didactic_state)));
    return { completed: false };
  }
  const { error } = await admin.from("training_transcripts").update({ delivery_status: "OUVIDO" }).eq("id", input.turnId);
  if (error) throw new Error("Não foi possível confirmar a reprodução.");
  if (turn.event_metadata?.finish_after_delivery !== true) return { completed: false };
  await persistDidacticState(session, acceptDignifiedExit(readDidacticState(session.didactic_state)));
  return finalizeTrainingSession({ userId: input.userId, sessionId: input.sessionId });
}
