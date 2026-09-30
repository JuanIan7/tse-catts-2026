export type AppealItemDecision = "PENDENTE" | "ACEITO" | "REJEITADO";
export type AppealStatus = "PENDENTE" | "ACEITO" | "PARCIAL" | "REJEITADO";

export function appealStatusFor(decisions: AppealItemDecision[]): AppealStatus {
  if (decisions.length === 0 || decisions.some((decision) => decision === "PENDENTE")) return "PENDENTE";
  if (decisions.every((decision) => decision === "ACEITO")) return "ACEITO";
  if (decisions.every((decision) => decision === "REJEITADO")) return "REJEITADO";
  return "PARCIAL";
}
