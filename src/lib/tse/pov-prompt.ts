import type { PublicBriefing } from "./session-case";

export function povPrompt(briefing: PublicBriefing) {
  return [
    "Use case: photorealistic-natural.",
    "Asset type: horizontal POV scene for a private emergency-communication training simulator.",
    "Primary request: realistic first-person point of view of an approach professional arriving at a fictional occurrence. Camera is the professional's eyes, at a respectful distance. Show only the ambient setting, time and lighting, general position and externally observable body language of one adult person.",
    `Scene/backdrop: ${briefing.contexto_observavel}`,
    `Observable details: ${briefing.observaveis_iniciais.join("; ")}`,
    "Style/medium: natural documentary photography, Brazil, no text, no watermark, horizontal landscape composition.",
    "Constraints: non-graphic, calm, dignified, no sensationalism. Never depict or imply method, self-harm act, injuries, blood, weapons, dangerous objects, body part closeups, or hidden personal information. Do not add emergency logos or readable signage.",
  ].join("\n");
}
