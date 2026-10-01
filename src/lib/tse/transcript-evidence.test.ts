import { describe, expect, it } from "vitest";
import { analyzeTranscriptEvidence, factorItemsFromEvidence, hasAcceptedSafeExit } from "./transcript-evidence";
import { dignifiedExitOfferState, mayFinalizeDignifiedExit } from "./dignified-exit-protocol";
import type { InternalCase } from "./session-case";

const caseData: InternalCase = {
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

describe("evidências determinísticas da transcrição", () => {
  it("reconhece fatores revelados pelo tentante e preserva a proporção", () => {
    const evidence = analyzeTranscriptEvidence(caseData, [
      { speaker: "PERSONAGEM", content: "Meu pai ainda fala comigo, mas eu me isolei depois que parei as consultas e os remédios." },
      { speaker: "ALUNO", content: "Você disse que seu pai mantém contato e que interrompeu o acompanhamento em saúde." },
    ]);
    expect(evidence.protection.map((match) => match.factor)).toContain("pai que mantém contato");
    expect(evidence.risk.map((match) => match.factor)).toContain("isolamento");
    expect(evidence.mainFactor?.factor).toBe(caseData.fator_principal);
    const items = factorItemsFromEvidence(caseData, evidence);
    expect(items.fatores_protecao).toMatchObject({ estado: "encontrou_explorou", ajuste: 1 / 3 });
    expect(items.fatores_risco).toMatchObject({ estado: "encontrou_isolou", ajuste: 1 / 3 });
    expect(items.fator_principal).toMatchObject({ estado: "encontrou_isolou" });
  });

  it("exige oferta médica segura e aceitação posterior para a saída digna", () => {
    const accepted = analyzeTranscriptEvidence(caseData, [
      { speaker: "ALUNO", content: "Vamos com a ambulância para o hospital e para atendimento médico especializado." },
      { speaker: "PERSONAGEM", content: "Tá bom, vamos juntos." },
    ]);
    const unsafe = analyzeTranscriptEvidence(caseData, [
      { speaker: "ALUNO", content: "Vamos sair daqui para você dar um abraço no seu pai." },
      { speaker: "PERSONAGEM", content: "Tá bom, vamos." },
    ]);
    expect(hasAcceptedSafeExit(accepted)).toBe(true);
    expect(hasAcceptedSafeExit(unsafe)).toBe(false);
  });

  it("não reaproveita aceitação depois de uma recusa ou mudança de assunto", () => {
    const refusedThenUnrelated = analyzeTranscriptEvidence(caseData, [
      { speaker: "ALUNO", content: "Vamos com a ambulância para o hospital e para atendimento médico especializado." },
      { speaker: "PERSONAGEM", content: "Não quero ir para hospital agora." },
      { speaker: "ALUNO", content: "Seu pai mantém contato com você?" },
      { speaker: "PERSONAGEM", content: "Tá bom, vamos conversar sobre ele." },
    ]);
    const delayedAcceptance = analyzeTranscriptEvidence(caseData, [
      { speaker: "ALUNO", content: "Vamos com a ambulância para o hospital e para atendimento médico especializado." },
      { speaker: "PERSONAGEM", content: "Preciso pensar um pouco." },
      { speaker: "ALUNO", content: "Eu entendo; seu pai parece importante." },
      { speaker: "PERSONAGEM", content: "Tá bom, vamos." },
    ]);
    expect(hasAcceptedSafeExit(refusedThenUnrelated)).toBe(false);
    expect(hasAcceptedSafeExit(delayedAcceptance)).toBe(false);
  });

  it("mantém os requisitos de 70%, risco, proteção e duas ferramentas", () => {
    const common = {
      acceptedMedicalOffer: true,
      hasProtection: true,
      hasRisk: true,
      toolCount: 2,
      durationMs: 1_000,
    };
    expect(mayFinalizeDignifiedExit({ ...common, activeElapsedMs: 699 })).toBe(false);
    expect(mayFinalizeDignifiedExit({ ...common, activeElapsedMs: 700 })).toBe(true);
    expect(mayFinalizeDignifiedExit({ ...common, hasRisk: false, activeElapsedMs: 700 })).toBe(false);
    expect(mayFinalizeDignifiedExit({ ...common, toolCount: 1, activeElapsedMs: 700 })).toBe(false);
  });

  it("mantém crédito fracionado da oferta sem antecipar a aceitação", () => {
    const evidence = analyzeTranscriptEvidence(caseData, [
      { speaker: "ALUNO", content: "Vamos com a ambulância para o hospital e para atendimento médico especializado." },
      { speaker: "PERSONAGEM", content: "Não quero ir agora." },
    ]);
    expect(hasAcceptedSafeExit(evidence)).toBe(false);
    const earlyOffer = {
      safeMedicalOffer: true,
      hasProtection: true,
      hasRisk: true,
      otherToolCount: 1,
      activeElapsedMs: 699,
      durationMs: 1_000,
    };
    expect(dignifiedExitOfferState({ ...earlyOffer, priorOfferCount: 0 })).toBe("parcial");
    expect(dignifiedExitOfferState({ ...earlyOffer, priorOfferCount: 1 })).toBe("feito");
    expect(dignifiedExitOfferState({ ...earlyOffer, priorOfferCount: 0, activeElapsedMs: 700 })).toBe("feito");
  });

  it("não inventa fator quando a conversa não corresponde à ficha", () => {
    const evidence = analyzeTranscriptEvidence(caseData, [{ speaker: "PERSONAGEM", content: "Hoje está muito barulho aqui." }]);
    expect(evidence.protection).toEqual([]);
    expect(evidence.risk).toEqual([]);
    expect(evidence.mainFactor).toBeNull();
  });
});
