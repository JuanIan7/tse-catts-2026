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
  titulo: z.string().min(1),
  dificuldade: difficultySchema,
  acionamento: z.string().min(20),
  contexto_observavel: z.string().min(80),
  informacoes_recebidas: z.array(z.string().min(10)).min(2),
  observaveis_iniciais: z.array(z.string().min(5)).min(2),
  condicoes_da_cena: z.array(z.string().min(5)).min(2),
  aparencia_observavel: z.string().min(20),
  orientacao: z.string().min(20),
});

export type InternalCase = z.infer<typeof internalCaseSchema>;
export type PublicBriefing = z.infer<typeof publicBriefingSchema>;

type ScenarioTemplate = {
  internalCase: InternalCase;
  publicBriefing: Omit<PublicBriefing, "dificuldade">;
};

const templates: ScenarioTemplate[] = [
  {
    internalCase: {
      fator_principal: "ruptura recente de vínculo afetivo relevante",
      fatores_risco: ["isolamento progressivo", "sono prejudicado nas últimas semanas", "sentimento persistente de desesperança"],
      fatores_protecao: ["vínculo afetivo com uma filha", "relação de confiança com uma irmã", "histórico de buscar ajuda em momentos difíceis"],
      perfil_comportamental: "retraído, com fala baixa e respostas inicialmente curtas",
      contexto: "mirante urbano arborizado ao entardecer, com circulação reduzida e equipe chegando para abordagem inicial",
      vinculos: ["filha em idade escolar", "irmã que mora na mesma cidade"],
      observaveis: ["pessoa adulta imóvel e silenciosa", "olhar voltado para baixo", "ombros tensos", "roupa compatível com o clima"],
      ocultas: ["não contou à família sobre a ruptura", "acredita ser um peso para os vínculos próximos"],
      condicoes_evolucao: ["reconhecer o sofrimento sem julgamento", "oferecer escolhas concretas", "respeitar pausas e limites"],
      condicoes_saida: ["aceitação inequívoca de uma Saída Digna", "continuidade concreta de cuidado", "retomada voluntária de vínculo protetivo"],
    },
    publicBriefing: {
      titulo: "Ocorrência simulada — mirante urbano ao entardecer",
      acionamento: "A central recebeu chamado de frequentadores de um mirante urbano relatando uma pessoa sozinha, muito abatida e sem responder aos primeiros contatos.",
      contexto_observavel: "A equipe chega ao mirante no fim da tarde. O local é aberto, arborizado e silencioso, com iluminação natural diminuindo. Uma pessoa adulta permanece sentada, afastada dos demais visitantes, mantendo o corpo encolhido e o olhar baixo. Não há movimentação brusca nem objetos de risco visíveis no espaço imediato.",
      informacoes_recebidas: [
        "Uma comerciante próxima informou que a pessoa chegou sozinha e permaneceu no mesmo ponto por bastante tempo.",
        "Os primeiros solicitantes tentaram conversar, mas receberam apenas respostas breves e pediram apoio especializado.",
        "Nenhum familiar está presente no momento da chegada da equipe.",
      ],
      observaveis_iniciais: ["postura fechada e pouca movimentação", "fala baixa quando responde", "olhar predominantemente voltado para baixo", "vestimenta comum e adequada ao clima"],
      condicoes_da_cena: ["circulação de pessoas já reduzida", "iluminação natural em declínio", "espaço suficiente para aproximação gradual", "equipe de apoio mantida a distância discreta"],
      aparencia_observavel: "Pessoa adulta de meia-idade, expressão cansada, roupas discretas em tons escuros e postura corporal retraída.",
      orientacao: "Inicie a abordagem com presença calma, apresentação clara e escuta. Trabalhe somente com o que é observável ou revelado durante o diálogo.",
    },
  },
  {
    internalCase: {
      fator_principal: "perda recente de referência profissional e sentido de pertencimento",
      fatores_risco: ["retraimento social", "dificuldade financeira recente", "autocrítica intensa"],
      fatores_protecao: ["amizade duradoura", "participação anterior em atividade comunitária", "responsabilidade afetiva com um animal de estimação"],
      perfil_comportamental: "ambivalente, irritadiço no início e mais comunicativo quando escutado",
      contexto: "passarela ampla de um terminal desativado no início da noite, com iluminação artificial e equipe se aproximando com cautela",
      vinculos: ["amigo de longa data", "grupo comunitário de bairro"],
      observaveis: ["pessoa adulta caminhando lentamente", "mãos fechadas", "respostas defensivas ao contato inicial", "atenção alternando entre a equipe e o ambiente"],
      ocultas: ["evitou responder mensagens de amigos", "teme decepcionar as pessoas próximas"],
      condicoes_evolucao: ["apresentação clara e não invasiva", "escuta ativa", "convite a pequenos próximos passos"],
      condicoes_saida: ["aceitação inequívoca de uma Saída Digna", "acordo concreto de acompanhamento", "conexão voluntária com vínculo protetivo"],
    },
    publicBriefing: {
      titulo: "Ocorrência simulada — passarela de terminal no início da noite",
      acionamento: "A central foi acionada por um vigilante após identificar uma pessoa andando repetidamente por uma passarela de acesso já fora do horário de maior movimento.",
      contexto_observavel: "A equipe encontra uma passarela larga, coberta e parcialmente iluminada. O fluxo de passageiros é baixo. Uma pessoa adulta caminha devagar de um lado para outro, para algumas vezes e observa a aproximação da equipe com desconfiança. Sua fala inicial é curta e defensiva, mas ela mantém contato verbal.",
      informacoes_recebidas: [
        "O vigilante relatou que a pessoa recusou ajuda informal e pediu para ficar sozinha.",
        "Não há acompanhantes identificados e nenhum pertence permite confirmar sua identidade.",
        "A administração do terminal reduziu o fluxo pelo acesso lateral para preservar a privacidade da abordagem.",
      ],
      observaveis_iniciais: ["caminhada lenta e repetitiva", "mãos tensas", "respostas breves e defensivas", "atenção preservada à presença da equipe"],
      condicoes_da_cena: ["iluminação artificial regular", "baixo ruído ambiental", "via lateral isolada para curiosos", "apoio posicionado fora do campo imediato"],
      aparencia_observavel: "Pessoa adulta jovem, roupas casuais amassadas, expressão irritada e cansada, mantendo postura defensiva durante o primeiro contato.",
      orientacao: "Evite confronto e pressa. Apresente-se, reconheça o incômodo da pessoa e permita que ela determine o ritmo inicial da conversa.",
    },
  },
];

export function briefingNarration(briefing: PublicBriefing) {
  return [
    briefing.acionamento,
    briefing.contexto_observavel,
    `Informações recebidas: ${briefing.informacoes_recebidas.join(" ")}`,
    `Condições observáveis da cena: ${briefing.condicoes_da_cena.join("; ")}.`,
    briefing.orientacao,
  ].join(" ");
}

export function createSessionCase(difficulty: Difficulty, random = Math.random) {
  const template = templates[Math.floor(random() * templates.length)];
  const internalCase = internalCaseSchema.parse(template.internalCase);
  const publicBriefing = publicBriefingSchema.parse({ ...template.publicBriefing, dificuldade: difficulty });
  return { internalCase, publicBriefing };
}
