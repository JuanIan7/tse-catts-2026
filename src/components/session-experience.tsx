"use client";

import { useState } from "react";
import type { PublicBriefing } from "@/lib/tse/session-case";
import { ScenarioMedia } from "./scenario-media";
import { VoiceConversation } from "./voice-conversation";

type ReplayTurn = { id: string; pending: boolean; content?: string };

export function SessionExperience({ sessionId, briefing, locationUrl, characterUrl, lastCharacterTurn, difficulty, startedAt }: {
  sessionId: string;
  briefing: PublicBriefing;
  locationUrl: string | null;
  characterUrl: string | null;
  lastCharacterTurn: ReplayTurn | null;
  difficulty: "FACIL" | "MEDIA" | "DIFICIL";
  startedAt: string | null;
}) {
  const [mediaReady, setMediaReady] = useState(false);
  return <>
    <ScenarioMedia
      sessionId={sessionId}
      briefing={briefing}
      locationUrl={locationUrl}
      characterUrl={characterUrl}
      onMediaReady={() => setMediaReady(true)}
    />
    <VoiceConversation sessionId={sessionId} lastCharacterTurn={lastCharacterTurn} mediaReady={mediaReady} difficulty={difficulty} startedAt={startedAt} narrationText={briefing.acionamento + " " + briefing.contexto_observavel + " Informações recebidas: " + briefing.informacoes_recebidas.join(" ")} />
  </>;
}
