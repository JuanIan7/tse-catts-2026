import type { PublicBriefing } from "./session-case";

export function povPrompt(briefing: PublicBriefing) {
  return [
    "Use case: photorealistic-natural.",
    "Asset type: wide establishing scene for a private emergency-communication training simulator.",
    "Primary request: realistic first-person view of a trained responder arriving at a fictional occurrence. The place must be immediately understandable. Show the adult person at a respectful distance as a small but recognizable part of the environment.",
    `Dispatch context: ${briefing.acionamento}`,
    `Scene/backdrop: ${briefing.contexto_observavel}`,
    `Scene conditions: ${briefing.condicoes_da_cena.join("; ")}`,
    `Observable details: ${briefing.observaveis_iniciais.join("; ")}`,
    "Style/medium: natural documentary photography, believable Brazilian setting, realistic scale and textures.",
    "Composition/framing: horizontal 3:2 establishing shot, environment dominant, responder-eye height, clear depth, adult person visible at a distance, no dramatic camera tilt.",
    "Lighting/mood: match the described time of day, restrained and credible, no cinematic sensationalism.",
    "Constraints: non-graphic, calm, dignified, no text, no watermark. Never depict or imply method, self-harm act, injuries, blood, weapons, dangerous objects, body-part closeups, emergency logos, readable signage, or hidden personal information.",
  ].join("\n");
}
