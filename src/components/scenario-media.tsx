"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicBriefing } from "@/lib/tse/session-case";
import styles from "./scenario-media.module.css";

type NarrationState = "idle" | "loading" | "playing";

export function ScenarioMedia({ sessionId, briefing, locationUrl, characterUrl }: { sessionId: string; briefing: PublicBriefing; locationUrl: string | null; characterUrl: string | null }) {
  const router = useRouter();
  const requestedImages = useRef(false);
  const narrationRef = useRef<HTMLAudioElement | null>(null);
  const narrationUrlRef = useRef<string | null>(null);
  const [generating, setGenerating] = useState(!locationUrl || !characterUrl);
  const [narration, setNarration] = useState<NarrationState>("idle");
  const [imageError, setImageError] = useState("");
  const [audioError, setAudioError] = useState("");

  useEffect(() => {
    if (requestedImages.current || (locationUrl && characterUrl)) return;
    requestedImages.current = true;
    void fetch(`/api/sessions/${sessionId}/images`, { method: "POST" })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? "As imagens próprias desta ocorrência ainda não ficaram prontas.");
        }
        router.refresh();
      })
      .catch((cause) => setImageError(cause instanceof Error ? cause.message : "Não foi possível gerar as imagens."))
      .finally(() => setGenerating(false));
  }, [characterUrl, locationUrl, router, sessionId]);

  useEffect(() => () => {
    narrationRef.current?.pause();
    if (narrationUrlRef.current) URL.revokeObjectURL(narrationUrlRef.current);
  }, []);

  async function toggleNarration() {
    if (narrationRef.current) {
      if (narration === "playing") {
        narrationRef.current.pause();
        setNarration("idle");
        return;
      }
      setAudioError("");
      try {
        await narrationRef.current.play();
        setNarration("playing");
      } catch {
        setAudioError("O navegador bloqueou o áudio. Toque novamente em ouvir descrição.");
        setNarration("idle");
      }
      return;
    }
    setAudioError("");
    setNarration("loading");
    try {
      const response = await fetch(`/api/sessions/${sessionId}/briefing-speech`, { cache: "no-store" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Não foi possível preparar a descrição em áudio.");
      }
      const url = URL.createObjectURL(await response.blob());
      narrationUrlRef.current = url;
      const audio = new Audio(url);
      narrationRef.current = audio;
      audio.onplaying = () => setNarration("playing");
      audio.onended = () => setNarration("idle");
      audio.onerror = () => {
        setNarration("idle");
        setAudioError("Não foi possível reproduzir a descrição em áudio.");
      };
      try {
        await audio.play();
      } catch {
        setNarration("idle");
        setAudioError("Áudio preparado. Toque novamente em ouvir descrição para reproduzir.");
      }
    } catch (cause) {
      setNarration("idle");
      setAudioError(cause instanceof Error ? cause.message : "Não foi possível preparar a descrição em áudio.");
    }
  }

  return <section className={styles.section}>
    <div className={styles.mediaGrid}>
      <figure className={styles.figure}>
        <img src={locationUrl ?? "/training/fallback-location.png"} alt="Vista geral do local da ocorrência simulada" />
        <figcaption>Local da ocorrência</figcaption>
        {generating && !locationUrl && <span className={styles.generating}>Gerando cena própria…</span>}
      </figure>
      <figure className={`${styles.figure} ${styles.portrait}`}>
        <img src={characterUrl ?? "/training/fallback-character.png"} alt="Representação visual fictícia do tentante" />
        <figcaption>Referência visual do tentante</figcaption>
        {generating && !characterUrl && <span className={styles.generating}>Gerando personagem…</span>}
      </figure>
    </div>
    <div className={styles.briefing}>
      <h2>Descrição da ocorrência</h2>
      <p className={styles.lead}><strong>Acionamento:</strong> {briefing.acionamento}</p>
      <p className={styles.lead}>{briefing.contexto_observavel}</p>
      <p><strong>Aparência observável:</strong> {briefing.aparencia_observavel}</p>
      <div className={styles.briefingGrid}>
        <div><h3>Informações recebidas</h3><ul>{briefing.informacoes_recebidas.map((item) => <li key={item}>{item}</li>)}</ul></div>
        <div><h3>Primeira leitura visual</h3><ul>{briefing.observaveis_iniciais.map((item) => <li key={item}>{item}</li>)}</ul></div>
        <div><h3>Condições da cena</h3><ul>{briefing.condicoes_da_cena.map((item) => <li key={item}>{item}</li>)}</ul></div>
      </div>
      <p className="notice">{briefing.orientacao}</p>
      <div className={styles.narration}>
        <button type="button" onClick={() => void toggleNarration()}>{narration === "playing" ? "Pausar descrição" : "Ouvir descrição da ocorrência"}</button>
        {narration !== "idle" && <span className={styles.voiceState}><span className={styles.speakerPulse}>◖</span>{narration === "loading" ? "Preparando narração…" : "Narrando a ocorrência…"}</span>}
      </div>
      {imageError && <p className={styles.error} role="alert">{imageError} A imagem ilustrativa permanece disponível.</p>}
      {audioError && <p className={styles.error} role="alert">{audioError}</p>}
    </div>
  </section>;
}
