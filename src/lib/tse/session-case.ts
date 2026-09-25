import { z } from "zod";
import { scenarioVariants } from "./scenario-variants";

export const difficultySchema = z.enum(["FACIL", "MEDIA", "DIFICIL"]);
export type Difficulty = z.infer<typeof difficultySchema>;

const internalCaseSchema = z.object({
  fator_principal: z.string().min(1),
  fatores_risco: z.array(z.string().min(1)).min(2),
  fatores_protecao: z.array(z.string().min(1)).min(2),
  perfil_comportamental: z.string().min(1),
  perfil_tipo: z.enum(["AGRESSIVO", "DEPRESSIVO", "PSICOTICO"]).optional(),
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
      perfil_comportamental: "depressivo e retraído; começa chorando, afasta o abordador e só se abre após várias falas de escuta",
      perfil_tipo: "DEPRESSIVO",
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
      perfil_comportamental: "agressivo e agitado; começa hostil, xinga sem eufemismos e manda o abordador se afastar; nunca ri da situação",
      perfil_tipo: "AGRESSIVO",
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
  {
    internalCase: {
      fator_principal: "interrupção recente de acompanhamento em saúde mental, acompanhada de confusão e medo",
      fatores_risco: ["isolamento nas últimas semanas", "sono muito irregular", "desconfiança crescente das pessoas próximas"],
      fatores_protecao: ["irmã que mantém contato frequente", "histórico de aceitar apoio de uma equipe de saúde", "vínculo com atividade artística comunitária"],
      perfil_comportamental: "psicótico e desorganizado; fala de vozes e portais de forma não gráfica, teme aproximação e não recupera lucidez repentinamente",
      perfil_tipo: "PSICOTICO",
      contexto: "quarto de uma residência ao anoitecer, com equipe de abordagem posicionada à entrada e ambiente preservado",
      vinculos: ["irmã que acionou ajuda", "grupo de arte da comunidade"],
      observaveis: ["pessoa adulta inquieta", "olhar alternando entre a equipe e pontos vazios da sala", "fala fragmentada e desconexa", "mãos tensas"],
      ocultas: ["parou de comparecer ao acompanhamento", "teme que a equipe queira puni-la"],
      condicoes_evolucao: ["validar o medo sem confirmar percepções irreais", "usar frases simples", "manter ritmo calmo e previsível"],
      condicoes_saida: ["aceitação inequívoca de apoio seguro", "acordo concreto de acompanhamento", "retomada voluntária de vínculo protetivo"],
    },
    publicBriefing: {
      titulo: "Ocorrência simulada — residência ao anoitecer",
      acionamento: "Uma familiar acionou a equipe após perceber que uma pessoa adulta passou a noite acordada, muito assustada e falando de modo difícil de acompanhar.",
      contexto_observavel: "A equipe chega a uma residência no início da noite. A familiar aguarda fora do cômodo e relata que a pessoa quase não dormiu. Dentro do quarto, a pessoa adulta permanece de pé, alterna o olhar entre a porta e pontos vazios do ambiente e responde com frases fragmentadas. Não há movimentação rápida da equipe nem objetos perigosos visíveis no espaço imediato.",
      informacoes_recebidas: [
        "A familiar informou que o contato verbal ficou mais difícil ao longo do dia.",
        "Ela pediu que a equipe se apresente com calma e evite entrar de surpresa.",
        "Não há outras pessoas dentro do cômodo.",
      ],
      observaveis_iniciais: ["fala fragmentada", "olhar inquieto", "postura de alerta", "respostas pouco conectadas às perguntas"],
      condicoes_da_cena: ["porta e percurso de saída desobstruídos", "iluminação suficiente para contato visual", "familiar fora do cômodo", "equipe de apoio mantida a distância"],
      aparencia_observavel: "Pessoa adulta jovem com roupas cotidianas amarrotadas, aparência cansada e expressão de medo, olhando repetidamente para diferentes pontos do quarto.",
      orientacao: "Apresente-se com frases curtas. Reconheça o medo sem confirmar percepções que você não compartilha e preserve a segurança da cena.",
    },
  },
];

const caseLibrary: ScenarioTemplate[] = [
  ...templates,
  ...scenarioVariants.map((variant) => ({
    internalCase: internalCaseSchema.parse({ ...templates[variant.baseTemplate].internalCase, ...variant.internalCase }),
    publicBriefing: { ...templates[variant.baseTemplate].publicBriefing, ...variant.publicBriefing },
  })),
];

export function openingCharacterLine(internalCase: InternalCase) {
  switch (internalCase.perfil_tipo) {
    case "AGRESSIVO":
      return "Que porra é essa? Quem chamou você? Fica longe de mim, caralho. Não vem bancar o herói.";
    case "PSICOTICO":
      return "Espera... você está ouvindo? A porta falou de novo. Não chega perto, eles disseram que você também vê o portal.";
    default:
      return "Não... não, fica aí. Eu não quero conversar com ninguém agora.";
  }
}

export function briefingNarration(briefing: PublicBriefing) {
  return [
    briefing.acionamento,
    briefing.contexto_observavel,
    `Informações recebidas: ${briefing.informacoes_recebidas.join(" ")}`,
  ].join(" ");
}

export function createSessionCase(difficulty: Difficulty, random = Math.random, recentTitles: string[] = []) {
  const recent = new Set(recentTitles);
  const eligible = caseLibrary.filter((template) => !recent.has(template.publicBriefing.titulo));
  const choices = eligible.length ? eligible : caseLibrary;
  const template = choices[Math.floor(random() * choices.length)];
  const internalCase = internalCaseSchema.parse(template.internalCase);
  const publicBriefing = publicBriefingSchema.parse({ ...template.publicBriefing, dificuldade: difficulty });
  return { internalCase, publicBriefing };
}
