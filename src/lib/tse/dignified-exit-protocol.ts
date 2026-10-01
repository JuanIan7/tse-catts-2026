export type DignifiedExitProtocol = {
  acceptedMedicalOffer: boolean;
  hasProtection: boolean;
  hasRisk: boolean;
  toolCount: number;
  activeElapsedMs: number;
  durationMs: number;
};

export type DignifiedExitOfferCredit = {
  safeMedicalOffer: boolean;
  priorOfferCount: number;
  hasProtection: boolean;
  hasRisk: boolean;
  otherToolCount: number;
  activeElapsedMs: number;
  durationMs: number;
};

/**
 * Crédito da ferramenta, separado da aceitação. Oferta precoce recebe 0,5;
 * a segunda oferta precoce completa o ponto. Após 70%, risco, proteção e uma
 * ferramenta já reconhecidos permitem crédito integral na oferta atual.
 */
export function dignifiedExitOfferState(input: DignifiedExitOfferCredit): "feito" | "parcial" | null {
  if (!input.safeMedicalOffer) return null;
  const qualifiedNow = input.hasProtection
    && input.hasRisk
    && input.otherToolCount >= 1
    && input.activeElapsedMs >= input.durationMs * 0.7;
  return qualifiedNow || input.priorOfferCount >= 1 ? "feito" : "parcial";
}

/** Mantém os requisitos protocolares antes de encerrar a ocorrência. */
export function mayFinalizeDignifiedExit(input: DignifiedExitProtocol) {
  return input.acceptedMedicalOffer
    && input.hasProtection
    && input.hasRisk
    && input.toolCount >= 2
    && input.activeElapsedMs >= input.durationMs * 0.7;
}
