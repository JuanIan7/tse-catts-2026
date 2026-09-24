type ErrorShape = { code?: unknown; status?: unknown; message?: unknown; error?: { code?: unknown; message?: unknown } };

export function openAIErrorMessage(cause: unknown, operation: string) {
  const value = cause && typeof cause === "object" ? cause as ErrorShape : {};
  const code = value.error?.code ?? value.code;
  const status = value.status;
  if (code === "credit_balance_exhausted" || code === "insufficient_quota") {
    return "A conta da API OpenAI está sem créditos. O administrador precisa adicionar saldo para ativar a voz e as respostas da simulação.";
  }
  if (status === 401 || status === 403 || code === "invalid_api_key") {
    return "A chave da API OpenAI não foi aceita. O administrador precisa revisar a integração.";
  }
  if (status === 429 || code === "rate_limit_exceeded") {
    return "A API OpenAI atingiu um limite temporário. Aguarde um pouco e tente novamente.";
  }
  return `Não foi possível ${operation} agora. Sua sessão permanece salva; tente novamente.`;
}

export async function openAIResponseError(response: Response, operation: string) {
  const body = await response.json().catch(() => ({})) as ErrorShape;
  return openAIErrorMessage({ ...body, status: response.status }, operation);
}
