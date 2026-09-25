import { z } from "zod";

export const voicePersonaSchema = z.object({
  apresentacao: z.enum(["MASCULINA", "FEMININA"]),
  faixa_etaria: z.enum(["JOVEM_ADULTA", "ADULTA", "MADURA"]),
  estado: z.enum(["SERENA", "IRRITADA", "EMBARGADA", "ASSUSTADA", "EMBRIAGADA_LEVE"]),
  descricao_visual: z.string().min(8),
});

export type VoicePersona = z.infer<typeof voicePersonaSchema>;

export function fallbackVoicePersona(profile?: string): VoicePersona {
  if (profile === "AGRESSIVO") return { apresentacao: "MASCULINA", faixa_etaria: "ADULTA", estado: "IRRITADA", descricao_visual: "Homem adulto, postura defensiva." };
  if (profile === "PSICOTICO") return { apresentacao: "FEMININA", faixa_etaria: "JOVEM_ADULTA", estado: "ASSUSTADA", descricao_visual: "Mulher jovem adulta, expressão de medo." };
  return { apresentacao: "FEMININA", faixa_etaria: "ADULTA", estado: "EMBARGADA", descricao_visual: "Mulher adulta, expressão cansada." };
}

export function characterVoice(persona: VoicePersona) {
  return persona.apresentacao === "MASCULINA" ? "onyx" : "shimmer";
}

export function characterVoiceInstructions(persona: VoicePersona) {
  const age = persona.faixa_etaria === "JOVEM_ADULTA" ? "jovem adulta" : persona.faixa_etaria === "MADURA" ? "madura" : "adulta";
  const presentation = persona.apresentacao === "MASCULINA" ? "masculina" : "feminina";
  const delivery = persona.estado === "IRRITADA" ? "com irritação contida, firmeza e impaciência, sem caricatura" : persona.estado === "EMBARGADA" ? "abatida, embargada e com pausas curtas de choro contido" : persona.estado === "ASSUSTADA" ? "assustada, hesitante e com ritmo fragmentado" : persona.estado === "EMBRIAGADA_LEVE" ? "com lentidão discreta e articulação levemente imprecisa, sem exagero" : "serena, natural e contida";
  return `Fale em português brasileiro com voz ${presentation} ${age}, ${delivery}. Interprete apenas a fala do personagem, sem narrar ações nem acrescentar palavras.`;
}
