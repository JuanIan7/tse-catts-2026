"use client";

import { useState } from "react";

export function InitialSilenceControl({ sessionId, available }: { sessionId: string; available: boolean }) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  if (!available) return null;

  async function register() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/sessions/${sessionId}/initial-silence`, { method: "POST" });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Não foi possível registrar o silêncio inicial.");
      setMessage("Silêncio inicial registrado no barema.");
      window.setTimeout(() => window.location.reload(), 250);
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Não foi possível registrar o silêncio inicial.");
      setPending(false);
    }
  }

  return <section className="panel initial-silence-control">
    <h2>Preparação da abordagem</h2>
    <p className="panel-subtitle">Antes da sua primeira fala, registre o silêncio inicial previsto no barema.</p>
    <button type="button" onClick={register} disabled={pending}>{pending ? "Registrando silêncio inicial…" : "Registrar silêncio inicial"}</button>
    {message && <p className="notice">{message}</p>}
  </section>;
}
