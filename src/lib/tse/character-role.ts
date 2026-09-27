function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ");
}

const roleInversionPatterns = [
  /\bo foco (aqui )?e voce\b/,
  /\bestou aqui para (te )?ouvir voce\b/,
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
];

export function hasCharacterRoleInversion(content: string) {
  const text = normalized(content);
  return roleInversionPatterns.some((pattern) => pattern.test(text));
}

export const safeCharacterFallback = "Não quero falar sobre a sua vida agora. Está tudo muito confuso para mim.";
