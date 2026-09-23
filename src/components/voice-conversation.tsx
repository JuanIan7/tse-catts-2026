"use client";
import { useRef, useState } from "react";

export function VoiceConversation({ sessionId }: { sessionId: string }) {
  const [status, setStatus] = useState("Voz desligada."); const pcRef = useRef<RTCPeerConnection | null>(null); const streamRef = useRef<MediaStream | null>(null);
  async function start() {
    try {
      setStatus("Solicitando microfone..."); const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream;
      const tokenResponse = await fetch("/api/realtime/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }) }); const token = await tokenResponse.json(); if (!tokenResponse.ok || !token.value) throw new Error(token.error ?? "Sessão indisponível.");
      const pc = new RTCPeerConnection(); pcRef.current = pc; const audio = document.createElement("audio"); audio.autoplay = true; pc.ontrack = (event) => { audio.srcObject = event.streams[0]; }; stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      const events = pc.createDataChannel("oai-events"); events.onmessage = () => {}; const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      const answerResponse = await fetch("https://api.openai.com/v1/realtime/calls", { method: "POST", headers: { Authorization: `Bearer ${token.value}`, "Content-Type": "application/sdp" }, body: offer.sdp }); if (!answerResponse.ok) throw new Error("Não foi possível conectar a voz."); await pc.setRemoteDescription({ type: "answer", sdp: await answerResponse.text() }); setStatus("Conectado. Fale naturalmente; o personagem responderá por voz.");
    } catch (error) { stop(); setStatus(error instanceof Error ? error.message : "Não foi possível iniciar a voz."); }
  }
  function stop() { pcRef.current?.close(); pcRef.current = null; streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; }
  return <section><h2>Conversa por voz</h2><p>{status}</p><button type="button" onClick={start} disabled={Boolean(pcRef.current)}>Iniciar voz</button> <button type="button" onClick={() => { stop(); setStatus("Voz encerrada."); }} disabled={!pcRef.current}>Encerrar voz</button><p className="notice">Use fones quando possível. A voz requer microfone e HTTPS ou localhost.</p></section>;
}
