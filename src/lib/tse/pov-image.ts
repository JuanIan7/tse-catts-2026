import "server-only";
import OpenAI from "openai";
import type { PublicBriefing } from "./session-case";
import { povPrompt } from "./pov-prompt";

export async function generatePovImage(briefing: PublicBriefing) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("Integração OpenAI ainda não configurada.");
  const image = await new OpenAI({ apiKey: key }).images.generate({ model: "gpt-image-2", prompt: povPrompt(briefing), size: "1536x1024", quality: "medium", output_format: "webp", moderation: "auto" });
  const data = image.data?.[0]?.b64_json;
  if (!data) throw new Error("A imagem POV não foi retornada.");
  return Buffer.from(data, "base64");
}
