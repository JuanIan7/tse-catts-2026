import "server-only";
import OpenAI from "openai";
import type { InternalCase, PublicBriefing } from "./session-case";
import { characterImagePrompt } from "./character-image-prompt";
import { povPrompt } from "./pov-prompt";

async function generateWebp(prompt: string) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Integração OpenAI ainda não configurada.");
  const image = await new OpenAI({ apiKey: key }).images.generate({
    model: "gpt-image-2",
    prompt,
    size: "1536x1024",
    quality: "medium",
    output_format: "webp",
    moderation: "auto",
  });
  const data = image.data?.[0]?.b64_json;
  if (!data) throw new Error("A imagem não foi retornada.");
  return Buffer.from(data, "base64");
}

export function generatePovImage(briefing: PublicBriefing) {
  return generateWebp(povPrompt(briefing));
}

export function generateCharacterImage(internalCase: InternalCase, briefing: PublicBriefing) {
  return generateWebp(characterImagePrompt(internalCase, briefing));
}
