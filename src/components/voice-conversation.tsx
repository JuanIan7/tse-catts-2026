"use client";

import { useEffect, useRef, useState } from "react";
import { sessionDurationMs } from "@/lib/tse/session-timer";
import styles from "./voice-conversation.module.css";

type Mode = "PRESSIONAR_PARA_FALAR" | "MICROFONE_ABERTO";
type Phase = "idle" | "recording" | "sending" | "playing" | "narrating" | "preparing";
type VoiceResult = { transcript: string; characterTurnId: string; characterText: string; pendingAudio: boolean; completed?: boolean };
type ReplayTurn = { id: string; pending: boolean; content?: string };
type PreparedAudio = { blob: Blob; turn?: ReplayTurn; text?: string };
type PreparedOpening = { narration: PreparedAudio; character: PreparedAudio };

function recorderOptions() {
  const preferred = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type));
  return preferred ? { mimeType: preferred } : undefined;
}

function recordingFilename(type: string) {
  if (type.includes("mp4")) return "fala.m4a";
  if (type.includes("ogg")) return "fala.ogg";
  return "fala.webm";
}

function formatRemaining(seconds: number) {
  return String(Math.floor(seconds / 60)).padStart(2, "0") + ":" + String(seconds % 60).padStart(2, "0");
}

export function VoiceConversation({ sessionId, lastCharacterTurn, pendingCharacterTurn, mediaReady, difficulty, startedAt, narrationText }: { sessionId: string; lastCharacterTurn: ReplayTurn | null; pendingCharacterTurn: ReplayTurn | null; mediaReady: boolean; difficulty: "FACIL" | "MEDIA" | "DIFICIL"; startedAt: string | null; narrationText: string }) {
  const [consented, setConsented] = useState(false);
  const [mode, setMode] = useState<Mode>("PRESSIONAR_PARA_FALAR");
  const [phase, setPhase] = useState<Phase>("preparing");
  const phaseRef = useRef<Phase>("preparing");
  const [openMic, setOpenMic] = useState(false);
  const [status, setStatus] = useState("Preparando o áudio da ocorrência…");
  const [error, setError] = useState("");
  const [replayTurn, setReplayTurn] = useState<ReplayTurn | null>(null);
  const [pendingReplayDone, setPendingReplayDone] = useState(false);
  const [initialReady, setInitialReady] = useState(!lastCharacterTurn);
  const [initialStarted, setInitialStarted] = useState(false);
  const durationMs = sessionDurationMs[difficulty];
  const [deadlineAt, setDeadlineAt] = useState<number | null>(() => startedAt ? new Date(startedAt).getTime() + durationMs : null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(() => startedAt ? Math.max(0, Math.ceil((new Date(startedAt).getTime() + durationMs - Date.now()) / 1000)) : null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioWatchRef = useRef<number | null>(null);
  const monitorRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastVoiceAtRef = useRef(0);
  const sendingRef = useRef(false);
  const initialAudioRef = useRef<PreparedOpening | null>(null);
  const initialStartedRef = useRef(false);
  const pressActiveRef = useRef(false);
  const playingTurnRef = useRef<ReplayTurn | null>(null);
  const timeoutSentRef = useRef(false);
  const speechStartedAtRef = useRef(0);

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { setPendingReplayDone(false); }, [pendingCharacterTurn?.id]);

  function unlockAudio() {
    const player = playerRef.current ?? new Audio();
    playerRef.current = player;
    try {
      player.muted = true;
      player.src = "data:audio/wav;base64,UklGRlYAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YTIAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA=";
      void player.play().then(() => { player.muted = false; }).catch(() => { player.muted = false; });
    } catch { player.muted = false; }
    try { const unlock = new SpeechSynthesisUtterance(" "); unlock.volume = 0.01; window.speechSynthesis.speak(unlock); } catch { /* Safari fallback unavailable */ }
  }

  function cleanAudio() {
    if (audioWatchRef.current !== null) window.clearInterval(audioWatchRef.current);
    audioWatchRef.current = null;
    const audio = audioRef.current;
    if (audio) { audio.onended = null; audio.onerror = null; audio.onpause = null; audio.onstalled = null; audio.pause(); }
    audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
  }

  function stopOpenMic() {
    setOpenMic(false);
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    if (monitorRef.current !== null) window.clearInterval(monitorRef.current);
    monitorRef.current = null;
    audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    releaseStream(streamRef.current);
  }

  function stopAll() {
    stopOpenMic();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    cleanAudio();
  }

  useEffect(() => () => stopAll(), []);

  async function request(url: string, init?: RequestInit) {
    const response = await fetch(url, init);
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? "Não foi possível concluir esta etapa da simulação.");
    }
    return response;
  }

  async function confirmDelivery(turnId: string, interrupted: boolean) {
    await request("/api/sessions/" + sessionId + "/delivery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ turnId, interrupted }) });
  }

  async function expireSession() {
    if (timeoutSentRef.current) return;
    timeoutSentRef.current = true;
    stopAll();
    setPhase("idle");
    setStatus("Tempo encerrado. Gerando sua avaliação…");
    try {
      const response = await request("/api/sessions/" + sessionId + "/timeout", { method: "POST" });
      const result = await response.json() as { completed?: boolean };
      if (result.completed) {
        window.location.reload();
        return;
      }
      timeoutSentRef.current = false;
      setStatus("Cronômetro sendo sincronizado com a sessão…");
      setDeadlineAt(Date.now() + 3000);
    } catch (cause) {
      timeoutSentRef.current = false;
      setError(cause instanceof Error ? cause.message : "Não foi possível encerrar a ocorrência.");
    }
  }

  function startClock() {
    if (deadlineAt) return;
    const fallbackDeadline = Date.now() + durationMs;
    setDeadlineAt(fallbackDeadline);
    setRemainingSeconds(Math.ceil(durationMs / 1000));
    void request("/api/sessions/" + sessionId + "/start", { method: "POST" })
      .then((response) => response.json() as Promise<{ startedAt: string | null; durationMs: number }>)
      .then((result) => {
        if (result.startedAt) {
          const serverDeadline = new Date(result.startedAt).getTime() + result.durationMs;
          setDeadlineAt(serverDeadline);
          setRemainingSeconds(Math.max(0, Math.ceil((serverDeadline - Date.now()) / 1000)));
        }
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Não foi possível iniciar o cronômetro."));
  }

  useEffect(() => {
    if (!deadlineAt) return;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000));
      setRemainingSeconds(seconds);
      if (seconds === 0) void expireSession();
    };
    tick();
    const interval = window.setInterval(tick, 500);
    return () => window.clearInterval(interval);
  }, [deadlineAt]);

  async function prepareInitialAudio() {
    if (!mediaReady) {
      initialAudioRef.current = null;
      setInitialReady(false);
      setPhase("preparing");
      setStatus("Aguardando a imagem da ocorrência…");
      return;
    }
    if (!lastCharacterTurn) { setInitialReady(true); setPhase("idle"); setStatus("Sua vez de falar."); return; }
    try {
      setError(""); setPhase("preparing"); setStatus("Preparando os áudios da ocorrência…");
      const [narration, character] = await Promise.all([
        request("/api/sessions/" + sessionId + "/briefing-speech", { cache: "no-store" }),
        request("/api/sessions/" + sessionId + "/speech?turnId=" + encodeURIComponent(lastCharacterTurn.id), { cache: "no-store" }),
      ]);
      initialAudioRef.current = {
        narration: { blob: await narration.blob(), text: narrationText },
        character: { blob: await character.blob(), turn: lastCharacterTurn },
      };
      setInitialReady(true); setPhase("idle"); setStatus("Tudo pronto. Inicie a simulação com áudio.");
    } catch (cause) {
      setPhase("idle"); setError(cause instanceof Error ? cause.message : "Não foi possível preparar os áudios da ocorrência.");
      setStatus("Tente preparar o áudio novamente.");
    }
  }

  useEffect(() => { void prepareInitialAudio(); }, [lastCharacterTurn?.id, mediaReady, narrationText, sessionId]);

  async function playPrepared(prepared: PreparedAudio, kind: "narration" | "character", onEnded?: () => Promise<void> | void) {
    cleanAudio();
    const url = URL.createObjectURL(prepared.blob);
    audioUrlRef.current = url;
    const audio = playerRef.current ?? new Audio();
    playerRef.current = audio;
    audio.muted = false;
    audio.src = url;
    if (prepared.turn) { audio.dataset.turnId = prepared.turn.id; audio.dataset.pending = String(prepared.turn.pending); }
    audioRef.current = audio;
    setPhase(kind === "narration" ? "narrating" : "playing");
    setStatus(kind === "narration" ? "Narrando a ocorrência…" : "Tentante falando…");
    let retried = false;
    let stalledCheck: number | null = null;
    let observedTime = -1;
    const stopWatch = () => { if (stalledCheck !== null) window.clearInterval(stalledCheck); if (audioWatchRef.current === stalledCheck) audioWatchRef.current = null; stalledCheck = null; };
    const fail = () => {
      if (!retried && !audio.ended) {
        retried = true;
        audio.currentTime = 0;
        void audio.play().catch(() => fail());
        return;
      }
      stopWatch();
      cleanAudio();
      setPhase("idle");
      if (kind === "narration") { initialStartedRef.current = false; setInitialStarted(false); }
      else if (prepared.turn) setReplayTurn(prepared.turn);
      setError("A reprodução de áudio foi interrompida. Tente novamente.");
    };
    audio.onended = () => { stopWatch(); cleanAudio(); void onEnded?.(); };
    audio.onerror = fail;
    audio.onstalled = () => window.setTimeout(() => { if (!audio.ended && audio.paused) fail(); }, 700);
    audio.onpause = () => window.setTimeout(() => { if (!audio.ended && audio.paused) fail(); }, 250);
    stalledCheck = window.setInterval(() => {
      if (!audio.ended && !audio.paused && audio.currentTime <= observedTime + 0.01) fail();
      observedTime = audio.currentTime;
    }, 3500);
    audioWatchRef.current = stalledCheck;
    await audio.play();
  }

  async function playCharacter(turn: ReplayTurn, blob?: Blob) {
    playingTurnRef.current = turn;
    const completed = async () => {
      playingTurnRef.current = null;
      setPhase("idle"); setStatus("Sua vez de falar."); setReplayTurn(null);
      if (turn.pending) {
        await confirmDelivery(turn.id, false).then(() => { if (pendingCharacterTurn?.id === turn.id) { setPendingReplayDone(true); window.setTimeout(() => window.location.reload(), 250); } }).catch((cause) => setError(cause instanceof Error ? cause.message : "A resposta foi ouvida, mas não foi confirmada."));
      }
    };
    const prepared = blob ? { blob, turn } : { blob: await (await request(`/api/sessions/${sessionId}/speech?turnId=${encodeURIComponent(turn.id)}`, { cache: "no-store" })).blob(), turn };
    try {
      await playPrepared(prepared, "character", completed);
    } catch {
      playingTurnRef.current = null;
      setReplayTurn(turn);
      setPhase("idle");
      setError("A voz do tentante não pôde ser iniciada. Toque em recuperar áudio para ouvir a resposta.");
    }
  }

  async function startInitialSequence() {
    unlockAudio();
    startClock();
    const prepared = initialAudioRef.current;
    if (!prepared || initialStartedRef.current) return;
    initialStartedRef.current = true;
    setInitialStarted(true);
    setError("");
    try {
      await playPrepared(prepared.narration, "narration", async () => {
        if (prepared.character.turn) await playCharacter(prepared.character.turn, prepared.character.blob);
      });
    } catch {
      initialStartedRef.current = false;
      setInitialStarted(false);
      setPhase("idle"); setError("O navegador bloqueou o início do áudio. Toque em iniciar novamente.");
    }
  }

  async function registerConsent() {
    setError("");
    try { await request("/api/voice/consent", { method: "POST" }); setConsented(true); setStatus("Microfone autorizado. Escolha como quer falar."); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível registrar o consentimento."); }
  }

  function releaseStream(stream: MediaStream | null) {
    stream?.getTracks().forEach((track) => track.stop());
    if (streamRef.current === stream) streamRef.current = null;
  }

  async function getFreshStream() {
    releaseStream(streamRef.current);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Este navegador não permite gravação pelo microfone. Use texto para continuar.");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    streamRef.current = stream;
    return stream;
  }

  async function uploadRecording(blob: Blob) {
    if (blob.size < 300) { setPhase("idle"); setStatus("Não identificamos uma fala. Tente novamente ou use texto."); return; }
    sendingRef.current = true; setPhase("sending"); setStatus("Transcrevendo sua fala…"); setError("");
    try {
      const form = new FormData(); form.set("audio", blob, recordingFilename(blob.type));
      const result = await (await request(`/api/sessions/${sessionId}/voice`, { method: "POST", body: form })).json() as VoiceResult;
      if (result.completed) { window.location.reload(); return; }
      await playCharacter({ id: result.characterTurnId, pending: result.pendingAudio, content: result.characterText });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível usar a voz.";
      if (message.includes("tempo da ocorrência terminou")) { window.location.reload(); return; }
      setPhase("idle"); setStatus("Use texto para continuar sem perder a sessão."); setError(message);
    }
    finally { sendingRef.current = false; }
  }

  function startRecording(stream: MediaStream) {
    if (recorderRef.current?.state === "recording" || sendingRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, recorderOptions());
    recorderRef.current = recorder;
    recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || chunksRef.current[0]?.type || "audio/webm" });
      recorderRef.current = null;
      if (mode === "PRESSIONAR_PARA_FALAR") releaseStream(stream);
      void uploadRecording(blob);
    };
    recorder.onerror = () => { setPhase("idle"); setError("O navegador interrompeu a gravação. Tente novamente ou use texto."); };
    speechStartedAtRef.current = Date.now();
    recorder.start(250); setPhase("recording"); setStatus(mode === "MICROFONE_ABERTO" ? "Microfone aberto — estou ouvindo…" : "Você está falando — solte para enviar.");
    window.setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 90_000);
  }

  async function interruptCharacter() {
    const audio = audioRef.current;
    const activeTurn = playingTurnRef.current;
    const turnId = audio?.dataset.turnId ?? activeTurn?.id;
    const pending = audio ? audio.dataset.pending === "true" : activeTurn?.pending === true;
    playingTurnRef.current = null;
    cleanAudio();
    window.speechSynthesis?.cancel();
    setPhase("idle");
    setStatus("Interrupção registrada. Estou ouvindo sua fala.");
    if (turnId && pending) void confirmDelivery(turnId, true).catch((cause) => setError(cause instanceof Error ? cause.message : "Não foi possível registrar a interrupção."));
  }

  async function beginPress() {
    if (!consented || sendingRef.current) return;
    pressActiveRef.current = true;
    try {
      if (phaseRef.current === "playing") await interruptCharacter();
      const stream = await getFreshStream();
      if (!pressActiveRef.current) { releaseStream(stream); return; }
      startRecording(stream);
    } catch (cause) {
      pressActiveRef.current = false;
      setError(cause instanceof Error ? cause.message : "Não foi possível acessar o microfone.");
    }
  }

  function endPress() {
    pressActiveRef.current = false;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function toggleOpenMic() {
    if (openMic) { stopOpenMic(); setStatus("Microfone aberto desativado."); return; }
    if (!consented) return;
    try {
      const stream = await getFreshStream();
      const context = new AudioContext(); await context.resume();
      const analyser = context.createAnalyser(); analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      const values = new Uint8Array(analyser.fftSize);
      audioContextRef.current = context; lastVoiceAtRef.current = Date.now(); setOpenMic(true); setStatus("Microfone aberto — aguardando sua fala.");
      let interruptStreak = 0;
      monitorRef.current = window.setInterval(() => {
        analyser.getByteTimeDomainData(values);
        const level = values.reduce((sum, value) => sum + Math.abs(value - 128), 0) / values.length;
        const now = Date.now();
        if (phaseRef.current === "playing") {
          // Sem fones, exigimos voz alta e sustentada (2 medições seguidas) antes de tratar como
          // interrupção real — evita que eco/ruído ambiente dispare uma interrupção falsa.
          if (level > 20) {
            interruptStreak += 1;
            if (interruptStreak >= 2 && recorderRef.current?.state !== "recording") {
              interruptStreak = 0;
              void interruptCharacter().then(() => startRecording(stream));
            }
          } else {
            interruptStreak = 0;
          }
          return;
        }
        interruptStreak = 0;
        if (phaseRef.current === "narrating" || sendingRef.current) return;
        if (level > 12) {
          lastVoiceAtRef.current = now;
          if (recorderRef.current?.state !== "recording") startRecording(stream);
        }
        if (recorderRef.current?.state === "recording" && now - lastVoiceAtRef.current > 10_000 && now - speechStartedAtRef.current > 1200) recorderRef.current.stop();
      }, 150);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível ativar o microfone aberto."); }
  }

  const recording = phase === "recording";
  const playing = phase === "playing" || phase === "narrating";
  return <section className={styles.console} aria-live="polite">
    <div className={styles.titleRow}><div><h2>Conversa por voz</h2><p>O áudio é transitório; a transcrição didática fica protegida na sessão.</p></div>{remainingSeconds !== null && <div className={styles.timer} aria-label="Tempo restante da ocorrência"><span>Tempo restante</span><strong>{formatRemaining(remainingSeconds)}</strong></div>}</div>
    {!mediaReady ? <p className={styles.hint}>Preparando as imagens da ocorrência…</p> : !initialReady ? <p className={styles.hint}>Preparando áudio…</p> : !initialStarted && lastCharacterTurn ? <button type="button" className={styles.replay} onClick={() => void startInitialSequence()}>Iniciar simulação com áudio</button> : <>
      {pendingCharacterTurn && !pendingReplayDone && <button type="button" className={styles.replay} onClick={() => void playCharacter(pendingCharacterTurn)} disabled={phase === "playing" || phase === "sending"}>Ouvir resposta pendente</button>}
      {!consented ? <div className={styles.consent}><p>Ao ativar a voz, você concorda com a transcrição temporária da sua fala para esta simulação.</p><button type="button" onClick={() => void registerConsent()}>Li e concordo em ativar voz</button></div> : <>
        <div className={styles.modes}><button type="button" className={`${styles.mode} ${mode === "PRESSIONAR_PARA_FALAR" ? styles.modeActive : ""}`} onClick={() => { stopOpenMic(); setMode("PRESSIONAR_PARA_FALAR"); }}>Pressione para falar</button><button type="button" className={`${styles.mode} ${mode === "MICROFONE_ABERTO" ? styles.modeActive : ""}`} onClick={() => { setMode("MICROFONE_ABERTO"); }}>Microfone aberto</button></div>
        <div className={`${styles.stage} ${recording ? styles.stageRecording : ""} ${playing ? styles.stagePlaying : ""}`}><div className={styles.activityIcon} aria-hidden="true"><span/><span/><span/><span/><span/></div><strong>{phase === "narrating" ? "Narrando ocorrência" : phase === "playing" ? "Tentante falando" : recording ? "Você está falando" : phase === "sending" ? "Processando sua fala" : "Sua vez de falar"}</strong><span>{status}</span></div>
        {mode === "PRESSIONAR_PARA_FALAR" ? <div className={styles.controls}><button className={styles.hold} type="button" draggable={false} onContextMenu={(event) => event.preventDefault()} onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); void beginPress(); }} onPointerUp={(event) => { event.preventDefault(); endPress(); }} onPointerCancel={endPress} disabled={phase === "sending"}>● {recording ? "Solte para enviar" : "Segure para falar"}</button></div> : <div className={styles.controls}><button className={`${styles.openControl} ${openMic ? styles.openControlActive : ""}`} type="button" onClick={() => void toggleOpenMic()} disabled={phase === "sending"}>◉ {openMic ? "Desativar microfone aberto" : "Ativar microfone aberto"}</button></div>}
        <p className={styles.hint}>{mode === "MICROFONE_ABERTO" ? "Sem fones, o microfone entra após a fala do tentante para evitar confundir o áudio reproduzido com sua voz." : "Segure para falar e solte para enviar. Limite máximo: 90 segundos."}</p>
      </>}
      {replayTurn && <button className={styles.replay} type="button" onClick={() => void playCharacter(replayTurn)}>Recuperar áudio</button>}
    </>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </section>;
}
