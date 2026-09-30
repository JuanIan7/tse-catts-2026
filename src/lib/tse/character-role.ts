function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
}

const roleInversionPatterns = [
  /\bo foco (aqui )?e voce\b/,
  /\b(eu )?estou aqui para (te )?ouvir( voce)?\b/,
  /\bcomo posso te ajudar\b/,
  /\bo que (te|lhe) (tem )?deixado preocupado\b/,
  /\bo que (esta|est[aá]) passando pela sua mente\b/,
  /\bvoce se sente seguro\b/,
  /\bonde voce mora\b/,
  /\bcomo voce se sente\b/,
  /\bqual (e )?(o )?seu trabalho\b/,
  /\bo que voce pensa\b/,
  /\bvamos conversar sobre (isso|sua vida|o que te preocupa)\b/,
  /\bo que voce gostaria de compartilhar\b/,
  /\bvoce esta bem\b/,
  /\besta tudo bem com voce\b/,
  /\bse quiser(,)? pode conversar\b/,
  /\bme conte (sobre voce|o que aconteceu com voce)\b/,
  /\bposso te ouvir\b/,
];

export function hasCharacterRoleInversion(content: string) {
  const text = normalized(content);
  return roleInversionPatterns.some((pattern) => pattern.test(text));
}

export const safeCharacterFallback = "Não quero falar sobre a sua vida agora. Está tudo muito confuso para mim.";

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Um nome só é aceito quando corresponde à identidade privada da ocorrência.
 * Não tentamos inferir a identidade por aparência ou pelo nome do aluno.
 */
export function hasCharacterIdentityMismatch(content: string, expectedName: string) {
  const text = normalized(content);
  const expected = normalized(expectedName);
  const introductions = [
    /\bmeu nome e ([a-z]+)\b/g,
    /\beu sou (?:o |a )?([a-z]+)\b/g,
    /\bpode me chamar de ([a-z]+)\b/g,
  ];
  return introductions.some((pattern) => [...text.matchAll(pattern)].some((match) => match[1] !== expected));
}

export function mentionsExpectedCharacterName(content: string, expectedName: string) {
  return new RegExp(`\\b${escaped(normalized(expectedName))}\\b`).test(normalized(content));
}
