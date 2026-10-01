export type RecalculatedEmailClaim = {
  claimed: boolean;
  status: "PENDING" | "SENT" | "FAILED";
  recipient: string;
  sent_at: string | null;
  created_at: string;
  recalculated_score: number;
};

const formatDateTime = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
}).format(new Date(value));

export function existingRecalculatedEmailMessage(claim: RecalculatedEmailClaim) {
  if (claim.status === "SENT") {
    return `A nota já foi enviada para ${claim.recipient} em ${formatDateTime(claim.sent_at ?? claim.created_at)}.`;
  }
  if (Date.now() - new Date(claim.created_at).getTime() >= 15 * 60 * 1000) {
    return "Não foi possível confirmar o resultado do envio. Consulte o histórico do provedor antes de iniciar outro recálculo.";
  }
  return "Já existe um envio em andamento para esta nota. Aguarde alguns segundos e atualize a página.";
}

export function recalculatedEmailFailureMessage(reason: string | null) {
  if (reason === "Configuração do Brevo incompleta. Cadastre BREVO_API_KEY e BREVO_FROM." || reason === "Configuração de e-mail pendente. Cadastre BREVO_API_KEY e BREVO_FROM.") {
    return reason;
  }
  return "O serviço de e-mail não aceitou o envio. Verifique o remetente configurado e tente novamente.";
}
