"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./voice-conversation.module.css";

type Mode = "PRESSIONAR_PARA_FALAR" | "MICROFONE_ABERTO";
type Phase = "idle" | "recording" | "sending" | "playing" | "narrating";
type VoiceResult = { transcript: string; characterTurnId: string; characterText: string; pendingAudio: boolean };
type ReplayTurn = { id: string; pending: boolean };

function recorderOptions() {
  const preferred = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type));
  return preferred ? { mimeType: preferred } : undefined;
}

function recordingFilename(type: string) {
  if (type.includes("mp4")) return "fala.m4a";
  if (type.includes("ogg")) return "fala.ogg";
  return "fala.webm";
}

export function VoiceConversation({ sessionId, lastCharacterTurn, started }: { sessionId: string; lastCharacterTurn: ReplayTurn | null; started: boolean }) {
  const [consented, setConsented] = useState(false);
  const [mode, setMode] = useState<Mode>("PRESSIONAR_PARA_FALAR");
  const [phase, setPhase] = useState<Phase>("idle");
  const phaseRef = useRef<Phase>("idle");
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  const [openMic, setOpenMic] = useState(false);
  const [status, setStatus] = useState("Inicie a simulação para ouvir a ocorrência.");
  const [error, setError] = useState("");
  const [replayTurn, setReplayTurn] = useState<ReplayTurn | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const monitorRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastVoiceAtRef = useRef(0);
  const sendingRef = useRef(false);
  const sequenceStartedRef = useRef(false);
  const activeRequestRef = useRef(0);

  function cleanAudio() {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.src = ""; }
    audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
  }

  function stopOpenMic() {
    setOpenMic(false);
    if (monitorRef.current !== null) window.clearInterval(monitorRef.current);
    monitorRef.current = null;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
  }

  function stopAll() {
    stopOpenMic();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    cleanAudio();
  }

  useEffect(() => () => stopAll(), []);

  async function requestJson(url: string, init?: RequestInit) {
    const response = await fetch(url, init);
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? "Não foi possível concluir esta etapa da simulação.");
    }
    return response;
  }

  async function registerConsent() {
    setError("");
    try {
      await requestJson("/api/voice/consent", { method: "POST" });
      setConsented(true);
      setStatus("Microfone autorizado. Escolha como quer falar.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível registrar o consentimento."); }
  }

  async function getStream() {
    if (streamRef.current) return streamRef.current;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Este navegador não permite gravação pelo microfone. Use texto para continuar.");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    streamRef.current = stream;
    return stream;
  }

  async function confirmDelivery(turnId: string, interrupted: boolean) {
    await requestJson(`/api/sessions/${sessionId}/delivery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ turnId, interrupted }) });
  }

  async function playBlob(blob: Blob, kind: "narration" | "character", turn?: ReplayTurn, onEnded?: () => Promise<void> | void) {
    cleanAudio();
    const url = URL.createObjectURL(blob);
    audioUrlRef.current = url;
    const audio = new Audio(url);
    if (turn) { audio.dataset.turnId = turn.id; audio.dataset.pending = String(turn.pending); }
    audioRef.current = audio;
    setPhase(kind === "narration" ? "narrating" : "playing");
    setStatus(kind === "narration" ? "Narrando a ocorrência…" : "Tentante falando…");
    audio.onended = () => { cleanAudio(); void onEnded?.(); };
    audio.onerror = () => { cleanAudio(); setPhase("idle"); if (turn) setReplayTurn(turn); setStatus("Áudio preparado para recuperação."); setError("O navegador não conseguiu reproduzir o áudio automaticamente. Toque em recuperar áudio."); };
    try { await audio.play(); }
    catch { cleanAudio(); setPhase("idle"); if (turn) setReplayTurn(turn); setError("Áudio preparado. Toque em recuperar áudio."); }
  }

  async function playCharacter(turn: ReplayTurn) {
    const response = await requestJson(`/api/sessions/${sessionId}/speech?turnId=${encodeURIComponent(turn.id)}`, { cache: "no-store" });
    await playBlob(await response.blob(), "character", turn, async () => {
      setPhase("idle"); setStatus("Sua vez de falar."); setReplayTurn(null);
      if (turn.pending) await confirmDelivery(turn.id, false).catch((cause) => setError(cause instanceof Error ? cause.message : "A resposta foi ouvida, mas a entrega não foi confirmada."));
    });
  }

  async function beginSequence() {
    if (sequenceStartedRef.current || !lastCharacterTurn) return;
    sequenceStartedRef.current = true;
    setError("");
    const requestId = ++activeRequestRef.current;
    try {
      const briefing = await requestJson(`/api/sessions/${sessionId}/briefing-speech`, { cache: "no-store" });
      if (requestId !== activeRequestRef.current) return;
      await playBlob(await briefing.blob(), "narration", undefined, async () => {
        if (requestId !== activeRequestRef.current) return;
        await playCharacter(lastCharacterTurn);
      });
    } catch (cause) { setPhase("idle"); setError(cause instanceof Error ? cause.message : "Não foi possível iniciar o áudio da ocorrência."); }
  }

  useEffect(() => { if (started) void beginSequence(); }, [started]);

  async function interruptCharacter() {
    const turnId = audioRef.current?.dataset.turnId;
    const pending = audioRef.current?.dataset.pending === "true";
    cleanAudio();
    if (turnId && pending) await confirmDelivery(turnId, true).catch((cause) => setError(cause instanceof Error ? cause.message : "Não foi possível registrar a interrupção."));
    setPhase("idle"); setStatus("Interrupção registrada. Estou ouvindo sua fala.");
  }

  async function uploadRecording(blob: Blob) {
    if (blob.size < 300) { setPhase("idle"); setStatus("Não identificamos uma fala. Tente novamente ou use texto."); return; }
    sendingRef.current = true; setPhase("sending"); setStatus("Transcrevendo sua fala…"); setError("");
    try {
      const form = new FormData(); form.set("audio", blob, recordingFilename(blob.type));
      const response = await requestJson(`/api/sessions/${sessionId}/voice`, { method: "POST", body: form });
      const result = await response.json() as VoiceResult;
      await playCharacter({ id: result.characterTurnId, pending: result.pendingAudio });
    } catch (cause) { setPhase("idle"); setStatus("Use texto para continuar sem perder a sessão."); setError(cause instanceof Error ? cause.message : "Não foi possível usar a voz."); }
    finally { sendingRef.current = false; }
  }

  function startRecording(stream: MediaStream) {
    if (recorderRef.current?.state === "recording" || sendingRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, recorderOptions());
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
    recorder.onstop = () => { const blob = new Blob(chunksRef.current, { type: recorder.mimeType || chunksRef.current[0]?.type || "audio/webm" }); recorderRef.current = null; void uploadRecording(blob); };
    recorder.onerror = () => { setPhase("idle"); setError("O navegador interrompeu a gravação. Tente novamente ou use texto."); };
    recorder.start(250); setPhase("recording"); setStatus(mode === "MICROFONE_ABERTO" ? "Microfone aberto — estou ouvindo…" : "Você está falando — solte para enviar.");
    window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 90_000);
  }

  async function beginPress() {
    if (!consented || sendingRef.current || !started) return;
    try { if (phase === "playing") await interruptCharacter(); startRecording(await getStream()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível acessar o microfone."); }
  }

  function endPress() { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); }

  async function toggleOpenMic() {
    if (openMic) { stopOpenMic(); setStatus("Microfone aberto desativado."); return; }
    if (!consented || !started) return;
    try {
      const stream = await getStream();
      const context = new AudioContext(); await context.resume();
      const analyser = context.createAnalyser(); analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      const values = new Uint8Array(analyser.fftSize);
      audioContextRef.current = context; lastVoiceAtRef.current = Date.now(); setOpenMic(true); setStatus("Microfone aberto — aguardando sua fala.");
      monitorRef.current = window.setInterval(() => {
        analyser.getByteTimeDomainData(values);
        const level = values.reduce((sum, value) => sum + Math.abs(value - 128), 0) / values.length;
        const now = Date.now();
        if (level > 12) {
          lastVoiceAtRef.current = now;
          if (phaseRef.current === "playing") void interruptCharacter().then(() => startRecording(stream));
          else if (!sendingRef.current && recorderRef.current?.state !== "recording") startRecording(stream);
        }
        if (recorderRef.current?.state === "recording" && now - lastVoiceAtRef.current > 1200) recorderRef.current.stop();
      }, 150);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível ativar o microfone aberto."); }
  }

  const recording = phase === "recording";
  const playing = phase === "playing" || phase === "narrating";
  return <section className={styles.console} aria-live="polite">
    <div className={styles.titleRow}><div><h2>Conversa por voz</h2><p>O áudio é transitório; a transcrição didática fica protegida na sessão.</p></div></div>
    {!started ? <p className={styles.hint}>Use o botão acima para iniciar a ocorrência com áudio.</p> : <>
      {!consented ? <div className={styles.consent}><p>Ao ativar a voz, você concorda com a transcrição temporária da sua fala para esta simulação.</p><button type="button" onClick={() => void registerConsent()}>Li e concordo em ativar voz</button></div> : <>
        <div className={styles.modes}><button type="button" className={`${styles.mode} ${mode === "PRESSIONAR_PARA_FALAR" ? styles.modeActive : ""}`} onClick={() => { stopOpenMic(); setMode("PRESSIONAR_PARA_FALAR"); }}>Pressione para falar</button><button type="button" className={`${styles.mode} ${mode === "MICROFONE_ABERTO" ? styles.modeActive : ""}`} onClick={() => { setMode("MICROFONE_ABERTO"); }}>Microfone aberto</button></div>
        <div className={`${styles.stage} ${recording ? styles.stageRecording : ""} ${playing ? styles.stagePlaying : ""}`}><div className={styles.activityIcon} aria-hidden="true"><span/><span/><span/><span/><span/></div><strong>{phase === "narrating" ? "Narrando ocorrência" : phase === "playing" ? "Tentante falando" : recording ? "Você está falando" : phase === "sending" ? "Processando sua fala" : "Sua vez de falar"}</strong><span>{status}</span></div>
        {mode === "PRESSIONAR_PARA_FALAR" ? <div className={styles.controls}><button className={styles.hold} type="button" draggable={false} onContextMenu={(event) => event.preventDefault()} onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); void beginPress(); }} onPointerUp={(event) => { event.preventDefault(); endPress(); }} onPointerCancel={endPress} disabled={phase === "sending"}>● {recording ? "Solte para enviar" : "Segure para falar"}</button></div> : <div className={styles.controls}><button className={`${styles.openControl} ${openMic ? styles.openControlActive : ""}`} type="button" onClick={() => void toggleOpenMic()} disabled={phase === "sending"}>◉ {openMic ? "Desativar microfone aberto" : "Ativar microfone aberto"}</button></div>}
        <p className={styles.hint}>{mode === "MICROFONE_ABERTO" ? "Conversa contínua sem fones: o sistema filtra eco e registra somente interrupções confirmadas." : "Segure para falar e solte para enviar. Limite máximo: 90 segundos."}</p>
      </>}
      {replayTurn && <button className={styles.replay} type="button" onClick={() => void playCharacter(replayTurn)}>Recuperar áudio</button>}
    </>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </section>;
}
