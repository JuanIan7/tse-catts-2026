"use client";

import { useState } from "react";
import type { PublicBriefing } from "@/lib/tse/session-case";
import { ScenarioMedia } from "./scenario-media";
import { VoiceConversation } from "./voice-conversation";

type ReplayTurn = { id: string; pending: boolean };

export function SessionExperience({ sessionId, briefing, locationUrl, characterUrl, lastCharacterTurn }: {
  sessionId: string;
  briefing: PublicBriefing;
  locationUrl: string | null;
  characterUrl: string | null;
  lastCharacterTurn: ReplayTurn | null;
}) {
  const [started, setStarted] = useState(false);
  return <>
    <ScenarioMedia
      sessionId={sessionId}
      briefing={briefing}
      locationUrl={locationUrl}
      characterUrl={characterUrl}
      started={started}
      onStart={() => setStarted(true)}
    />
    <VoiceConversation sessionId={sessionId} lastCharacterTurn={lastCharacterTurn} started={started} />
  </>;
}
