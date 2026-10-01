import { afterEach, describe, expect, it, vi } from "vitest";
import { createDidacticState } from "./didactic-state";
import { evaluateCompletedTranscript } from "./final-evaluation";
import type { InternalCase, PublicBriefing } from "./session-case";

const internalCase: InternalCase = {
  identidade: { nome: "Bianca", apresentacao: "FEMININA" },
  fator_principal: "medo intenso após interromper acompanhamento em saúde",
  fatores_risco: ["sono irregular", "isolamento", "desconfiança de pessoas próximas"],
  fatores_protecao: ["pai que mantém contato", "agente de saúde conhecido", "atividade musical comunitária"],
  perfil_comportamental: "psicótico e apreensivo",
  perfil_tipo: "PSICOTICO",
  voz_personagem: { apresentacao: "FEMININA", faixa_etaria: "JOVEM_ADULTA", estado: "ASSUSTADA", descricao_visual: "Pessoa adulta assustada." },
  contexto: "residência coletiva",
  vinculos: ["pai", "agente comunitário de saúde"],
  observaveis: ["fala desconexa"],
  ocultas: ["faltou a consultas recentes", "tem medo de punição"],
  condicoes_evolucao: ["usar frases simples"],
  condicoes_saida: ["aceitação de apoio seguro"],
};

const briefing: PublicBriefing = {
  titulo: "Ocorrência simulada",
  dificuldade: "MEDIA",
  acionamento: "Acionamento fictício para teste da avaliação.",
  contexto_observavel: "Contexto observável fictício para teste da avaliação final e do reconhecimento da conversa.",
  informacoes_recebidas: ["Informação inicial segura.", "Outra informação inicial segura."],
  observaveis_iniciais: ["fala baixa", "postura tensa"],
  condicoes_da_cena: ["local preservado", "apoio discreto"],
  aparencia_observavel: "Pessoa adulta em cenário didático.",
  orientacao: "Conduza a conversa com calma.",
};

afterEach(() => vi.unstubAllEnvs());

describe("avaliação final com evidência da transcrição", () => {
  it("preserva fatores, domínio e solução segura quando o avaliador de IA não está disponível", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const result = await evaluateCompletedTranscript({
      state: createDidacticState(),
      internalCase,
      briefing,
      partial: false,
      reason: "SAÍDA DIGNA ACEITA",
      transcript: [
        { speaker: "PERSONAGEM", content: "Meu pai ainda fala comigo, mas o isolamento aumentou depois que interrompi meu acompanhamento em saúde.", delivery_status: "OUVIDO" },
        { speaker: "ALUNO", content: "Deixa eu ver se eu entendi: o isolamento aumentou depois que você interrompeu o acompanhamento em saúde, e seu pai mantém contato. É isso?", delivery_status: "OUVIDO" },
        { speaker: "PERSONAGEM", content: "É isso. Eu fiquei com medo desde que parei o acompanhamento.", delivery_status: "OUVIDO" },
        { speaker: "ALUNO", content: "Seu pai sabe que você está passando por esse medo?", delivery_status: "OUVIDO" },
        { speaker: "PERSONAGEM", content: "Ele sabe um pouco, mas eu não queria preocupar ele.", delivery_status: "OUVIDO" },
        { speaker: "ALUNO", content: "Vamos com a ambulância para o hospital, onde você terá atendimento médico especializado. Eu acompanho você até lá.", delivery_status: "OUVIDO" },
        { speaker: "PERSONAGEM", content: "Tá bom, vamos juntos.", delivery_status: "OUVIDO" },
      ],
    });

    const item = (id: string) => result.itens.find((entry) => entry.id === id);
    expect(item("fatores_protecao")).toMatchObject({ estado: "encontrou_explorou", ajuste: 1 / 3 });
    expect(item("fatores_risco")).toMatchObject({ estado: "encontrou_isolou", ajuste: 1 / 3 });
    expect(item("fator_principal")).toMatchObject({ estado: "encontrou_isolou", ajuste: 1 });
    expect(item("desistencia_ou_saida_digna")).toMatchObject({ estado: "feito" });
    expect(item("conduziu_solucao")).toMatchObject({ estado: "feito" });
    expect(item("dominou_dialogo")).toMatchObject({ estado: "feito" });
  });

  it("preserva o crédito integral de saída digna já reconhecido, mesmo no encerramento parcial", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const state = createDidacticState();
    state.itens.desistencia_ou_saida_digna = { estado: "feito", evidencias: ["Oferta médica válida realizada após os requisitos protocolares."] };
    const result = await evaluateCompletedTranscript({
      state,
      internalCase,
      briefing,
      partial: true,
      reason: "TEMPO ESGOTADO",
      transcript: [
        { speaker: "ALUNO", content: "Vamos com a ambulância para o hospital, onde você terá atendimento médico especializado.", delivery_status: "OUVIDO" },
        { speaker: "PERSONAGEM", content: "Eu preciso de mais um instante para pensar.", delivery_status: "OUVIDO" },
      ],
    });
    expect(result.itens.find((entry) => entry.id === "desistencia_ou_saida_digna")).toMatchObject({ estado: "feito" });
    expect(result.itens.find((entry) => entry.id === "conduziu_solucao")).toMatchObject({ estado: "nao_feito" });
  });
});
