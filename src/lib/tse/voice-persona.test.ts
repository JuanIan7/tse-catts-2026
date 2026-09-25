import { describe, expect, it } from "vitest";
import { characterVoice, characterVoiceInstructions, fallbackVoicePersona } from "./voice-persona";

describe("persona de voz do personagem", () => {
  it("mantém a voz e a direção coerentes com a persona adulta", () => {
    const masculine = fallbackVoicePersona("AGRESSIVO");
    const feminine = fallbackVoicePersona("DEPRESSIVO");
    expect(characterVoice(masculine)).toBe("onyx");
    expect(characterVoice(feminine)).toBe("shimmer");
    expect(characterVoiceInstructions(masculine)).toContain("masculina adulta");
    expect(characterVoiceInstructions(feminine)).toContain("embargada");
  });
});
