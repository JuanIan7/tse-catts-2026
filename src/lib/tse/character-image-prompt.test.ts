import { describe, expect, it } from "vitest";
import { characterImagePrompt } from "./character-image-prompt";
import { createSessionCase } from "./session-case";

describe("characterImagePrompt", () => {
  it("usa apenas aparência e perfil necessários, com limites não gráficos", () => {
    const { internalCase, publicBriefing } = createSessionCase("MEDIA", () => 0);
    const prompt = characterImagePrompt(internalCase, publicBriefing);
    expect(prompt).toContain(publicBriefing.aparencia_observavel);
    expect(prompt).toContain(internalCase.perfil_comportamental);
    expect(prompt).toContain("Never depict a self-harm act");
    expect(prompt).not.toContain(internalCase.ocultas[0]);
  });
});
