import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { respondAsCharacter } from "./character";
import { acceptDignifiedExit, applyDidacticSignals, calculateDidacticEvaluation, readDidacticState, recordInterruption, registerInitialSilence as registerInitialSilenceState, seriousOccurrenceCount } from "./didactic-state";
import { detectSevereOccurrences, isPlainEndPhrase } from "./severe-occurrence";
import { openAIErrorMessage } from "./openai-error";
import type { Difficulty, InternalCase } from "./session-case";
import { isSessionExpired, sessionDurationMs } from "./session-timer";
import { evaluateCompletedTranscript } from "./final-evaluation";
import { normalizePublicBriefing } from "./briefing";

type Speaker = "ALUNO" | "PERSONAGEM" | "NARRADOR" | "SISTEMA";
type Source = "TEXTO" | "VOZ" | "SISTEMA";
type DeliveryStatus = "PENDENTE" | "OUVIDO" | "INTERROMPIDO";
type TranscriptTurn = { speaker: Speaker; content: string };
type SessionRecord = { id: string; user_id: string; status: string; difficulty: Difficulty; started_at: string | null; didactic_state: unknown; didactic_state_revision: number };
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
  const { data } = await createSupabaseAdminClient().from("training_sessions").select("id, user_id, status, difficulty, started_at, didactic_state, didactic_state_revision").eq("id", sessionId).maybeSingle();
  const session = data as SessionRecord | null;
  if (!session || session.user_id !== userId) throw new Error("Ocorrência indisponível.");
  return session;
}

export async function startTrainingSession(input: { userId: string; sessionId: string }) {
  const session = await getOwnedSession(input.userId, input.sessionId);
  if (terminalStatuses.has(session.status)) throw new Error("Esta ocorrência já foi encerrada.");
  await transitionToActive(session);
  const activeSession = await getOwnedSession(input.userId, input.sessionId);
  const durationMs = sessionDurationMs[activeSession.difficulty];
  return { startedAt: activeSession.started_at, durationMs };
}

async function finalCalculation(session: SessionRecord, reason: string, partial: boolean) {
  const admin = createSupabaseAdminClient();
  const [{ data: secret }, { data: transcript }, { data: publicSession }] = await Promise.all([
    admin.from("training_session_secrets").select("internal_case").eq("session_id", session.id).maybeSingle(),
    admin.from("training_transcripts").select("speaker, content, delivery_status").eq("session_id", session.id).order("sequence_number", { ascending: true }),
    admin.from("training_sessions").select("public_briefing").eq("id", session.id).maybeSingle(),
  ]);
  if (!secret || !publicSession) return calculateDidacticEvaluation(readDidacticState(session.didactic_state));
  return evaluateCompletedTranscript({ state: readDidacticState(session.didactic_state), internalCase: secret.internal_case as InternalCase, briefing: normalizePublicBriefing(publicSession.public_briefing, session.difficulty), transcript: transcript ?? [], partial, reason });
}

async function finalizeSevereOccurrenceLimit(input: { userId: string; sessionId: string; occurrences: number }) {
  const session = await getOwnedSession(input.userId, input.sessionId);
  if (terminalStatuses.has(session.status)) return { completed: true };
  if (session.status !== "AVALIACAO_PENDENTE") await transition(session.id, "AVALIACAO_PENDENTE");
  const baseCalculation = await finalCalculation(session, "LIMITE DE OCORRÊNCIAS GRAVES ATINGIDO", true);
  const calculation = { ...baseCalculation, nota_bruta: 0, nota_final: 0, encerramento_forcado: true, ocorrencias_graves: input.occurrences, motivo_encerramento: "LIMITE DE OCORRÊNCIAS GRAVES ATINGIDO" };
  const { error } = await createSupabaseAdminClient().from("evaluations").upsert({
    session_id: session.id, user_id: input.userId, partial: true, result: "SEM_EXITO", rubric_version: "0.4", item_states: calculation.itens, grave_errors: calculation.erros_graves, calculation, final_score: 0,
  }, { onConflict: "session_id" });
  if (error) throw new Error("Não foi possível preparar a avaliação automática.");
  await transition(session.id, "ENCERRADA_SEM_EXITO");
  return { completed: true };
}

export async function finalizeTrainingSession(input: { userId: string; sessionId: string }) {
  const session = await getOwnedSession(input.userId, input.sessionId);
  if (terminalStatuses.has(session.status)) return { completed: true };
  const state = readDidacticState(session.didactic_state);
  if (!state.saida_digna_aceita) return { completed: false };
  if (session.status !== "AVALIACAO_PENDENTE") await transition(session.id, "AVALIACAO_PENDENTE");
  const calculation = await finalCalculation(session, "SAÍDA DIGNA ACEITA", false);
  const { error: evaluationError } = await createSupabaseAdminClient().from("evaluations").upsert({
    session_id: session.id, user_id: input.userId, partial: calculation.parcial, result: "EXITO", rubric_version: "0.4", item_states: calculation.itens, grave_errors: calculation.erros_graves, calculation, final_score: calculation.nota_final,
  }, { onConflict: "session_id" });
  if (evaluationError) throw new Error("Não foi possível preparar a avaliação automática.");
  await transition(session.id, "ENCERRADA_COM_EXITO");
  return { completed: true };
}

export async function finalizeManualTrainingSession(input: { userId: string; sessionId: string }) {
  let session = await getOwnedSession(input.userId, input.sessionId);
  if (terminalStatuses.has(session.status)) return { completed: true };
  await transitionToActive(session);
  session = await getOwnedSession(input.userId, input.sessionId);
  if (session.status !== "AVALIACAO_PENDENTE") await transition(session.id, "AVALIACAO_PENDENTE");
  const calculation = await finalCalculation(session, "ENCERRAMENTO MANUAL", true);
  const { error: evaluationError } = await createSupabaseAdminClient().from("evaluations").upsert({
    session_id: session.id, user_id: input.userId, partial: true, result: "SEM_EXITO", rubric_version: "0.4", item_states: calculation.itens, grave_errors: calculation.erros_graves, calculation, final_score: calculation.nota_final,
  }, { onConflict: "session_id" });
  if (evaluationError) throw new Error("Não foi possível preparar a avaliação automática.");
  await transition(session.id, "ENCERRADA_SEM_EXITO");
  return { completed: true };
}

export async function registerInitialSilence(input: { userId: string; sessionId: string }) {
  let session = await getOwnedSession(input.userId, input.sessionId);
  if (!activeStatuses.has(session.status)) throw new Error("O silêncio inicial só pode ser registrado em uma ocorrência ativa.");
  await transitionToActive(session);
  session = await getOwnedSession(input.userId, input.sessionId);
  const registered = registerInitialSilenceState(readDidacticState(session.didactic_state));
  if (!registered.recorded) throw new Error("O silêncio inicial só pode ser registrado uma vez, antes da primeira fala.");
  await appendTranscript(session.id, "SISTEMA", "Silêncio inicial registrado antes da primeira fala do aluno.", "SISTEMA", "OUVIDO", { event: "SILENCIO_INICIAL" });
  await persistDidacticState(session, registered.state);
  return { recorded: true };
}

export async function finalizeTimedTrainingSession(input: { userId: string; sessionId: string }) {
  let session = await getOwnedSession(input.userId, input.sessionId);
  if (terminalStatuses.has(session.status)) return { completed: true };
  if (!session.started_at) throw new Error("A ocorrência ainda não foi iniciada.");
  if (!isSessionExpired(session.difficulty, session.started_at)) return { completed: false };
  if (session.status === "CRIADA" || session.status === "RECONEXAO") {
    await transitionToActive(session);
    session = await getOwnedSession(input.userId, input.sessionId);
  }
  if (session.status !== "AVALIACAO_PENDENTE") await transition(session.id, "AVALIACAO_PENDENTE");
  const calculation = await finalCalculation(session, "TEMPO ESGOTADO", true);
  const { error: evaluationError } = await createSupabaseAdminClient().from("evaluations").upsert({
    session_id: session.id, user_id: input.userId, partial: true, result: "SEM_EXITO", rubric_version: "0.4", item_states: calculation.itens, grave_errors: calculation.erros_graves, calculation, final_score: calculation.nota_final,
  }, { onConflict: "session_id" });
  if (evaluationError) throw new Error("Não foi possível preparar a avaliação automática.");
  await transition(session.id, "ENCERRADA_SEM_EXITO");
  return { completed: true };
}

export async function recordStudentTurn(input: { userId: string; sessionId: string; content: string; source: "TEXTO" | "VOZ" }) {
  const content = input.content.trim();
  if (!content || content.length > 3000) throw new Error("Envie uma fala entre 1 e 3000 caracteres.");
  let session = await getOwnedSession(input.userId, input.sessionId);
  if (!activeStatuses.has(session.status)) throw new Error("Ocorrência indisponível.");
  await transitionToActive(session);
  if (!session.started_at) session = await getOwnedSession(input.userId, input.sessionId);
  if (isSessionExpired(session.difficulty, session.started_at)) {
    await finalizeTimedTrainingSession(input);
    throw new Error("O tempo da ocorrência terminou. A avaliação foi gerada automaticamente.");
  }
  const didacticState = readDidacticState(session.didactic_state);
  const admin = createSupabaseAdminClient();
  const { data: rawHistory } = await admin.from("training_transcripts").select("speaker, content, created_at").eq("session_id", input.sessionId).eq("delivery_status", "OUVIDO").order("sequence_number", { ascending: false }).limit(8);
  const newestStudentTurn = (rawHistory ?? []).find((turn) => turn.speaker === "ALUNO");
  if (newestStudentTurn && Date.now() - new Date(newestStudentTurn.created_at).getTime() < 2000) throw new Error("Aguarde dois segundos antes de enviar outra fala.");
  const history = (rawHistory ?? []).reverse().map((turn) => ({ speaker: turn.speaker as Speaker, content: turn.content })) as TranscriptTurn[];
  const { data: secret } = await admin.from("training_session_secrets").select("internal_case").eq("session_id", input.sessionId).maybeSingle();
  if (!secret) throw new Error("Ficha pedagógica indisponível.");

  // A resposta precisa existir antes de registrar a fala. Uma falha da IA não pode deixar turnos órfãos.
  let character;
  try {
    character = await respondAsCharacter(secret.internal_case as InternalCase, [...history, { speaker: "ALUNO", content }], didacticState);
  } catch (cause) {
    console.error("Falha ao gerar resposta do tentante", { status: (cause as { status?: number })?.status, code: (cause as { code?: string })?.code });
    throw new Error(openAIErrorMessage(cause, "gerar a resposta do tentante"));
  }
  await transitionToActive(session);
  await appendTranscript(input.sessionId, "ALUNO", content, input.source, "OUVIDO");
  const deliveryStatus: DeliveryStatus = input.source === "VOZ" ? "PENDENTE" : "OUVIDO";
  const acceptsExit = character.aceita_saida_digna && !isPlainEndPhrase(content);
  const deterministicErrors = detectSevereOccurrences(content);
  const errorSignals = [...deterministicErrors, ...character.erros_graves].filter((signal, index, all) => all.findIndex((candidate) => candidate.erro_id === signal.erro_id) === index);
  const characterTurn = await appendTranscript(input.sessionId, "PERSONAGEM", character.fala, "SISTEMA", deliveryStatus, { finish_after_delivery: acceptsExit });
  const nextState = applyDidacticSignals(didacticState, {
    rapport_delta: character.rapport_delta,
    categorias_reveladas: character.categorias_reveladas,
    evidencias: character.evidencias,
    erros_graves: errorSignals,
    acceptsExit: input.source === "TEXTO" && acceptsExit,
  });
  await persistDidacticState(session, nextState);
  const occurrences = seriousOccurrenceCount(nextState);
  if (occurrences > 5) {
    await finalizeSevereOccurrenceLimit({ userId: input.userId, sessionId: input.sessionId, occurrences });
    return { characterTurnId: characterTurn.id, characterText: character.fala, pendingAudio: false, completed: true };
  }
  const completed = input.source === "TEXTO" && acceptsExit ? (await finalizeTrainingSession({ userId: input.userId, sessionId: input.sessionId })).completed : false;
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
