import { z } from "zod";

export const difficultySchema = z.enum(["FACIL", "MEDIA", "DIFICIL"]);
export type Difficulty = z.infer<typeof difficultySchema>;

const internalCaseSchema = z.object({
  fator_principal: z.string().min(1),
  fatores_risco: z.array(z.string().min(1)).min(2),
  fatores_protecao: z.array(z.string().min(1)).min(2),
  perfil_comportamental: z.string().min(1),
  contexto: z.string().min(1),
  vinculos: z.array(z.string().min(1)).min(1),
  observaveis: z.array(z.string().min(1)).min(1),
  ocultas: z.array(z.string().min(1)).min(1),
  condicoes_evolucao: z.array(z.string().min(1)).min(1),
  condicoes_saida: z.array(z.string().min(1)).min(1),
});

const publicBriefingSchema = z.object({
  titulo: z.string(),
  dificuldade: difficultySchema,
  contexto_observavel: z.string(),
  observaveis_iniciais: z.array(z.string()).min(1),
  orientacao: z.string(),
});

export type InternalCase = z.infer<typeof internalCaseSchema>;
export type PublicBriefing = z.infer<typeof publicBriefingSchema>;

const templates: InternalCase[] = [
  {
    fator_principal: "ruptura recente de vínculo afetivo relevante",
    fatores_risco: ["isolamento progressivo", "sono prejudicado nas últimas semanas", "sentimento persistente de desesperança"],
    fatores_protecao: ["vínculo afetivo com uma filha", "relação de confiança com uma irmã", "histórico de buscar ajuda em momentos difíceis"],
    perfil_comportamental: "retraído, com fala baixa e respostas inicialmente curtas",
    contexto: "área externa pública ao entardecer, com circulação reduzida e equipe chegando para abordagem inicial",
    vinculos: ["filha em idade escolar", "irmã que mora na mesma cidade"],
    observaveis: ["pessoa adulta imóvel e silenciosa", "olhar voltado para baixo", "ombros tensos", "roupa compatível com o clima"],
    ocultas: ["não contou à família sobre a ruptura", "acredita ser um peso para os vínculos próximos"],
    condicoes_evolucao: ["reconhecer o sofrimento sem julgamento", "oferecer escolhas concretas", "respeitar pausas e limites"],
    condicoes_saida: ["aceitação inequívoca de uma Saída Digna", "continuidade concreta de cuidado", "retomada voluntária de vínculo protetivo"],
  },
  {
    fator_principal: "perda recente de referência profissional e sentido de pertencimento",
    fatores_risco: ["retraimento social", "dificuldade financeira recente", "autocrítica intensa"],
    fatores_protecao: ["amizade duradoura", "participação anterior em atividade comunitária", "responsabilidade afetiva com um animal de estimação"],
    perfil_comportamental: "ambivalente, irritadiço no início e mais comunicativo quando escutado",
    contexto: "espaço público de passagem no início da noite, com iluminação ambiente e equipe se aproximando com cautela",
    vinculos: ["amigo de longa data", "grupo comunitário de bairro"],
    observaveis: ["pessoa adulta andando lentamente", "mãos fechadas", "respostas defensivas ao contato inicial"],
    ocultas: ["evitou responder mensagens de amigos", "teme decepcionar as pessoas próximas"],
    condicoes_evolucao: ["apresentação clara e não invasiva", "escuta ativa", "convite a pequenos próximos passos"],
    condicoes_saida: ["aceitação inequívoca de uma Saída Digna", "acordo concreto de acompanhamento", "conexão voluntária com vínculo protetivo"],
  },
];

export function createSessionCase(difficulty: Difficulty, random = Math.random) {
  const internalCase = internalCaseSchema.parse(templates[Math.floor(random() * templates.length)]);
  const publicBriefing = publicBriefingSchema.parse({
    titulo: "Ocorrência simulada — chegada da equipe",
    dificuldade: difficulty,
    contexto_observavel: internalCase.contexto,
    observaveis_iniciais: internalCase.observaveis,
    orientacao: "Inicie a abordagem com presença, segurança e escuta. Nem todos os elementos da ocorrência estão disponíveis de imediato.",
  });
  return { internalCase, publicBriefing };
}
