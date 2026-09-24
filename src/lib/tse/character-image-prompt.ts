import type { InternalCase, PublicBriefing } from "./session-case";

export function characterImagePrompt(internalCase: InternalCase, briefing: PublicBriefing) {
  return [
    "Use case: photorealistic-natural.",
    "Asset type: contextual portrait for a private emergency-communication training simulator.",
    "Primary request: dignified, realistic environmental portrait of one fictional adult person before a conversation with a trained responder.",
    `Scene/backdrop: ${briefing.contexto_observavel}`,
    `Externally observable appearance: ${briefing.aparencia_observavel}`,
    `Behavioral direction: ${internalCase.perfil_comportamental}`,
    "Style/medium: natural documentary photography, believable Brazilian setting, authentic clothing and skin texture, no glamorization.",
    "Composition/framing: waist-up or seated three-quarter view, person clearly visible, environment softly present, respectful distance, landscape 3:2.",
    "Lighting/mood: natural available light, restrained and serious, emotionally credible without melodrama.",
    "Constraints: one adult only, fully clothed, non-graphic, dignified, no text, no watermark. Never depict a self-harm act, method, injury, blood, weapon, dangerous object, emergency logo, diagnosis label, or readable personal information.",
  ].join("\n");
}
