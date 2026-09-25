import type { DidacticErrorSignal } from "./didactic-state";

// Reconhece somente ofensas explícitas dirigidas ao personagem. O modelo pode
// continuar classificando outros erros pedagógicos, mas não decide sozinho
// quando há hostilidade verbal repetida.
const hostileExpressions = /\b(caralho|porra|filho\s+da\s+puta|vai\s+se\s+foder|idiota|imbecil|ot[aá]rio|babaca)\b/i;

export function detectSevereOccurrences(content: string): DidacticErrorSignal[] {
  const normalized = content.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!hostileExpressions.test(normalized)) return [];
  return [{ erro_id: "hostilidade_verbal", evidencia: content.trim().slice(0, 500) }];
}

export function isPlainEndPhrase(content: string) {
  return /^\s*(fim\s+(da|de)\s+abordagem|encerrar\s+(a\s+)?abordagem)\s*[.!]*\s*$/i.test(content);
}
