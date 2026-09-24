import { describe, expect, it } from "vitest";
import { povPrompt } from "./pov-prompt";
import { createSessionCase } from "./session-case";

describe("povPrompt", () => {
  it("restringe a imagem ao briefing observável e aos limites de segurança", () => {
    const { publicBriefing } = createSessionCase("MEDIA", () => 0);
    const prompt = povPrompt(publicBriefing);
    expect(prompt).toContain(publicBriefing.observaveis_iniciais[0]);
    expect(prompt).toContain("Never depict or imply method");
    expect(prompt).toContain("no text");
  });
});
