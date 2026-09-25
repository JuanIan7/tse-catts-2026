"use client";

import { useState } from "react";
import type { PublicBriefing } from "@/lib/tse/session-case";
import { ScenarioMedia } from "./scenario-media";
import { VoiceConversation } from "./voice-conversation";
import { InitialSilenceControl } from "./initial-silence-control";

type ReplayTurn = { id: string; pending: boolean; content?: string };

export function SessionExperience({ sessionId, briefing, locationUrl, lastCharacterTurn, pendingCharacterTurn, difficulty, startedAt, initialSilenceAvailable }: {
  sessionId: string;
  briefing: PublicBriefing;
  locationUrl: string | null;
  lastCharacterTurn: ReplayTurn | null;
  pendingCharacterTurn: ReplayTurn | null;
  difficulty: "FACIL" | "MEDIA" | "DIFICIL";
  startedAt: string | null;
  initialSilenceAvailable: boolean;
}) {
  const [mediaReady, setMediaReady] = useState(false);
  return <>
    <ScenarioMedia
      sessionId={sessionId}
      briefing={briefing}
      locationUrl={locationUrl}
      onMediaReady={() => setMediaReady(true)}
    />
    <VoiceConversation sessionId={sessionId} lastCharacterTurn={lastCharacterTurn} pendingCharacterTurn={pendingCharacterTurn} mediaReady={mediaReady} difficulty={difficulty} startedAt={startedAt} narrationText={briefing.acionamento + " " + briefing.contexto_observavel + " Informações recebidas: " + briefing.informacoes_recebidas.join(" ")} />
    <InitialSilenceControl sessionId={sessionId} available={initialSilenceAvailable} />
  </>;
}
