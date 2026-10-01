export type AppealItemDecision = "PENDENTE" | "ACEITO" | "REJEITADO";
export type AppealStatus = "PENDENTE" | "ACEITO" | "PARCIAL" | "REJEITADO";
export type AppealSender = { name?: string; email?: string };

export function appealSenderFor(userId: string, senders: ReadonlyMap<string, AppealSender>) {
  const sender = senders.get(userId);
  return { name: sender?.name ?? "Aluno", email: sender?.email ?? "E-mail não informado" };
}

export function appealStatusFor(decisions: AppealItemDecision[]): AppealStatus {
  if (decisions.length === 0 || decisions.some((decision) => decision === "PENDENTE")) return "PENDENTE";
  if (decisions.every((decision) => decision === "ACEITO")) return "ACEITO";
  if (decisions.every((decision) => decision === "REJEITADO")) return "REJEITADO";
  return "PARCIAL";
}
