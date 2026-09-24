"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicBriefing } from "@/lib/tse/session-case";
import styles from "./scenario-media.module.css";

export function ScenarioMedia({ sessionId, briefing, locationUrl, characterUrl, onMediaReady }: {
  sessionId: string;
  briefing: PublicBriefing;
  locationUrl: string | null;
  characterUrl: string | null;
  onMediaReady: () => void;
}) {
  const router = useRouter();
  const requestedImages = useRef(false);
  const [generating, setGenerating] = useState(!locationUrl || !characterUrl);
  const [imageError, setImageError] = useState("");

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

  useEffect(() => { if (!generating) onMediaReady(); }, [generating, onMediaReady]);

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
      {imageError && <p className={styles.error} role="alert">{imageError} A imagem ilustrativa permanece disponível.</p>}
    </div>
  </section>;
}
