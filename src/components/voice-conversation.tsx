"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./voice-conversation.module.css";

type Mode = "PRESSIONAR_PARA_FALAR" | "MICROFONE_ABERTO";
type Phase = "idle" | "recording" | "sending" | "playing";
type VoiceResult = { transcript: string; characterTurnId: string; characterText: string; pendingAudio: boolean };
type ReplayTurn = { id: string; pending: boolean };

function recorderOptions() {
  const preferred = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"].find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type));
  return preferred ? { mimeType: preferred } : undefined;
}

function recordingFilename(type: string) {
  if (type.includes("mp4")) return "fala.m4a";
  if (type.includes("ogg")) return "fala.ogg";
  if (type.includes("wav")) return "fala.wav";
  return "fala.webm";
}

export function VoiceConversation({ sessionId, lastCharacterTurn }: { sessionId: string; lastCharacterTurn: ReplayTurn | null }) {
  const router = useRouter();
  const [consented, setConsented] = useState(false);
  const [mode, setMode] = useState<Mode>("PRESSIONAR_PARA_FALAR");
  const [phase, setPhase] = useState<Phase>("idle");
  const [openMic, setOpenMic] = useState(false);
  const [status, setStatus] = useState("Voz desligada. Você também pode responder por texto.");
  const [error, setError] = useState("");
  const [replayTurn, setReplayTurn] = useState<ReplayTurn | null>(lastCharacterTurn);
  const lastCharacterId = lastCharacterTurn?.id ?? null;
  useEffect(() => {
    if (lastCharacterTurn) setReplayTurn(lastCharacterTurn);
  // A new turn can arrive after a server-action refresh; status changes on the same turn must not replay it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastCharacterId]);
  const [elapsed, setElapsed] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const monitorRef = useRef<number | null>(null);
  const recordingDeadlineRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastVoiceAtRef = useRef(0);
  const openMicRef = useRef(false);
  const sendingRef = useRef(false);
  const pressActiveRef = useRef(false);
  const activityStartedAtRef = useRef(0);

  useEffect(() => {
    if (phase !== "recording" && phase !== "playing") { setElapsed(0); return; }
    activityStartedAtRef.current = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - activityStartedAtRef.current) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [phase]);

  function clearRecordingDeadline() {
    if (recordingDeadlineRef.current !== null) window.clearTimeout(recordingDeadlineRef.current);
    recordingDeadlineRef.current = null;
  }

  function cleanAudio() {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.src = ""; }
    audioRef.current = null;
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
  }

  function stopOpenMic() {
    openMicRef.current = false; setOpenMic(false);
    if (monitorRef.current !== null) window.clearInterval(monitorRef.current);
    monitorRef.current = null;
    audioContextRef.current?.close().catch(() => undefined); audioContextRef.current = null;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function stopAll() {
    pressActiveRef.current = false; stopOpenMic(); clearRecordingDeadline(); cleanAudio();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null; recorderRef.current = null; setPhase("idle");
  }

  useEffect(() => () => stopAll(), []);

  async function registerConsent() {
    setError("");
    const response = await fetch("/api/voice/consent", { method: "POST" });
    const body = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) return setError(body.error ?? "Não foi possível registrar o consentimento.");
    setConsented(true); setStatus("Pronto para usar o microfone.");
  }

  async function getStream() {
    if (streamRef.current) return streamRef.current;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw new Error("Este navegador não permite gravação pelo microfone. Use texto para continuar.");
    setStatus("Solicitando microfone…");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    streamRef.current = stream;
    return stream;
  }

  async function confirmDelivery(turnId: string, interrupted: boolean) {
    const response = await fetch(`/api/sessions/${sessionId}/delivery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ turnId, interrupted }) });
    if (!response.ok) throw new Error("Não foi possível confirmar a entrega da resposta.");
    router.refresh();
  }

  async function interruptCharacter() {
    const turnId = audioRef.current?.dataset.turnId;
    const pending = audioRef.current?.dataset.pending === "true";
    if (!turnId) return;
    cleanAudio(); setReplayTurn(null); setPhase("idle"); setStatus("Interrupção registrada. Sua fala será enviada agora.");
    if (pending) await confirmDelivery(turnId, true).catch(() => undefined);
  }

  async function playCharacter(turnId: string, pending: boolean) {
    setPhase("playing"); setStatus("Tentante falando — escute antes de responder."); setError(""); setReplayTurn(null);
    if (audioRef.current?.dataset.turnId === turnId && audioRef.current.src) {
      try {
        await audioRef.current.play();
      } catch {
        setPhase("idle"); setReplayTurn({ id: turnId, pending });
        setError("O navegador bloqueou a reprodução. Toque novamente em ouvir a fala.");
      }
      return;
    }
    try {
      const response = await fetch(`/api/sessions/${sessionId}/speech?turnId=${encodeURIComponent(turnId)}`, { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Não foi possível preparar a voz do tentante.");
      }
      const url = URL.createObjectURL(await response.blob()); audioUrlRef.current = url;
      const audio = new Audio(url); audio.dataset.turnId = turnId; audio.dataset.pending = String(pending); audioRef.current = audio;
      audio.onended = async () => { cleanAudio(); setPhase("idle"); setStatus("Sua vez de falar."); if (pending) await confirmDelivery(turnId, false).catch(() => setError("A resposta foi ouvida, mas não foi possível confirmar a entrega. Recarregue a página.")); };
      audio.onerror = () => { cleanAudio(); setPhase("idle"); setReplayTurn({ id: turnId, pending }); setStatus("Toque para reproduzir a resposta do tentante."); };
      await audio.play();
    } catch (cause) {
      const blocked = cause instanceof DOMException && cause.name === "NotAllowedError";
      if (!blocked) cleanAudio();
      setPhase("idle"); setReplayTurn({ id: turnId, pending }); setStatus("Toque para reproduzir a resposta do tentante.");
      setError(blocked ? "Áudio preparado. Toque novamente em ouvir a fala para reproduzir." : cause instanceof Error ? cause.message : "Não foi possível reproduzir o áudio.");
    }
  }

  async function uploadRecording(blob: Blob) {
    if (blob.size < 300) { setPhase("idle"); setStatus("Não identificamos uma fala. Tente novamente ou use texto."); return; }
    sendingRef.current = true; setPhase("sending"); setStatus("Transcrevendo sua fala…"); setError("");
    try {
      const form = new FormData(); form.set("audio", blob, recordingFilename(blob.type));
      const response = await fetch(`/api/sessions/${sessionId}/voice`, { method: "POST", body: form });
      const result = await response.json().catch(() => ({})) as Partial<VoiceResult> & { error?: string };
      if (!response.ok || !result.characterTurnId) throw new Error(result.error ?? "Não foi possível processar sua fala.");
      router.refresh(); await playCharacter(result.characterTurnId, true);
    } catch (cause) {
      setPhase("idle"); setError(cause instanceof Error ? cause.message : "Não foi possível usar a voz."); setStatus("Use o campo de texto para continuar sem perder a sessão.");
    } finally { sendingRef.current = false; }
  }

  function startRecording(stream: MediaStream) {
    if (recorderRef.current?.state === "recording" || sendingRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, recorderOptions()); recorderRef.current = recorder;
    recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
    recorder.onerror = () => { clearRecordingDeadline(); setPhase("idle"); setError("O navegador interrompeu a gravação. Tente novamente ou use texto."); };
    recorder.onstop = () => {
      clearRecordingDeadline();
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || chunksRef.current[0]?.type || "audio/webm" });
      recorderRef.current = null; void uploadRecording(blob);
    };
    recorder.start(250);
    recordingDeadlineRef.current = window.setTimeout(() => {
      if (recorder.state === "recording") { setStatus("Limite de 90 segundos atingido. Enviando sua fala…"); recorder.stop(); }
    }, 90_000);
    setPhase("recording"); setStatus(mode === "MICROFONE_ABERTO" ? "Microfone aberto — estou ouvindo…" : "Você está falando — solte para enviar.");
  }

  async function beginPressToTalk() {
    if (!consented || phase === "sending") return;
    try {
      if (phase === "playing") await interruptCharacter();
      const stream = await getStream();
      if (!pressActiveRef.current) { setStatus("Microfone autorizado. Pressione novamente e segure para falar."); return; }
      startRecording(stream);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível acessar o microfone."); setStatus("Use texto para continuar."); }
  }

  function endPressToTalk() {
    pressActiveRef.current = false;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function toggleOpenMic() {
    if (openMicRef.current) { stopOpenMic(); setPhase("idle"); setStatus("Microfone aberto desativado."); return; }
    let context: AudioContext | null = null;
    try {
      // O Safari exige que o contexto de áudio seja iniciado no gesto do usuário.
      context = new AudioContext();
      await context.resume();
      const stream = await getStream();
      if (context.state !== "running") throw new Error("O navegador não iniciou o monitoramento do microfone. Toque para ativar novamente.");
      const source = context.createMediaStreamSource(stream); const analyser = context.createAnalyser();
      analyser.fftSize = 1024; source.connect(analyser); audioContextRef.current = context;
      const values = new Uint8Array(analyser.fftSize); openMicRef.current = true; setOpenMic(true); lastVoiceAtRef.current = Date.now(); setStatus("Microfone aberto — aguardando sua fala.");
      monitorRef.current = window.setInterval(() => {
        analyser.getByteTimeDomainData(values);
        const level = values.reduce((sum, value) => sum + Math.abs(value - 128), 0) / values.length;
        const now = Date.now();
        if (level > 7) {
          lastVoiceAtRef.current = now;
          if (audioRef.current && !audioRef.current.paused) void interruptCharacter();
          if (!sendingRef.current && recorderRef.current?.state !== "recording") startRecording(stream);
        }
        if (recorderRef.current?.state === "recording" && now - lastVoiceAtRef.current > 1200) recorderRef.current.stop();
      }, 150);
    } catch (cause) {
      if (context) void context.close().catch(() => undefined);
      setError(cause instanceof Error ? cause.message : "Não foi possível ativar o microfone aberto.");
    }
  }

  const recording = phase === "recording";
  const playing = phase === "playing";
  return <section className={styles.console} aria-live="polite">
    <div className={styles.titleRow}><div><h2>Conversa por voz</h2><p>Use fones sempre que possível. O áudio bruto não é salvo.</p></div></div>
    {replayTurn && <button className={styles.replay} type="button" onClick={() => void playCharacter(replayTurn.id, replayTurn.pending)}>{replayTurn.pending ? "Tocar resposta do tentante" : "Ouvir fala do tentante"}</button>}
    {!consented && playing && <p className={styles.hint} role="status">🔊 Tentante falando…</p>}
    {!consented ? <div className={styles.consent}><p>Ao ativar a voz, você concorda com a transcrição temporária da sua fala e o envio à IA para esta simulação. As transcrições didáticas ficam protegidas por até 180 dias.</p><button type="button" onClick={() => void registerConsent()}>Li e concordo em ativar voz</button></div> : <>
      <div className={styles.modes}><button type="button" className={`${styles.mode} ${mode === "PRESSIONAR_PARA_FALAR" ? styles.modeActive : ""}`} onClick={() => { stopOpenMic(); setMode("PRESSIONAR_PARA_FALAR"); }}>Pressione para falar</button><button type="button" className={`${styles.mode} ${mode === "MICROFONE_ABERTO" ? styles.modeActive : ""}`} onClick={() => { stopOpenMic(); setMode("MICROFONE_ABERTO"); }}>Microfone aberto</button></div>
      <div className={`${styles.stage} ${recording ? styles.stageRecording : ""} ${playing ? styles.stagePlaying : ""}`}>
        <div className={styles.activityIcon} aria-hidden="true"><span/><span/><span/><span/><span/></div>
        <strong>{playing ? "Tentante falando" : recording ? "Você está falando" : phase === "sending" ? "Processando sua fala" : "Sua vez de falar"}</strong>
        <span>{status}</span>
        {(recording || playing) && <time>{elapsed}s</time>}
      </div>
      {mode === "PRESSIONAR_PARA_FALAR" ? <div className={styles.controls}><button className={styles.hold} type="button" draggable={false} onContextMenu={(event) => event.preventDefault()} onPointerDown={(event) => { event.preventDefault(); pressActiveRef.current = true; event.currentTarget.setPointerCapture(event.pointerId); void beginPressToTalk(); }} onPointerUp={(event) => { event.preventDefault(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); endPressToTalk(); }} onPointerCancel={endPressToTalk} onKeyDown={(event) => { if ((event.code === "Space" || event.code === "Enter") && !event.repeat) { pressActiveRef.current = true; void beginPressToTalk(); } }} onKeyUp={(event) => { if (event.code === "Space" || event.code === "Enter") endPressToTalk(); }} disabled={phase === "sending"}>● {recording ? "Solte para enviar" : "Segure para falar"}</button></div> : <div className={styles.controls}><button className={`${styles.openControl} ${openMic ? styles.openControlActive : ""}`} type="button" onClick={() => void toggleOpenMic()} disabled={phase === "sending"}>◉ {openMic ? "Desativar microfone aberto" : "Ativar microfone aberto"}</button></div>}
      <p className={styles.hint}>{mode === "MICROFONE_ABERTO" ? "Se você falar enquanto o tentante responde, a resposta é interrompida e a sobreposição é registrada. Fones reduzem interrupções acidentais." : "Mantenha o botão pressionado durante toda a fala e solte para enviar. Limite máximo: 90 segundos."}</p>
    </>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </section>;
}
