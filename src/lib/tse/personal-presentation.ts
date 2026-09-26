function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, " ").toLowerCase().replace(/\s+/g, " ");
}

export function isPersonalPresentation(content: string) {
  const text = normalized(content);
  const identifiesService = /\bcorpo de bombeiros?\b/.test(text) || /\bcbmerj\b/.test(text);
  const identifiesName = /\b(?:eu sou|eu me chamo|me chamo|meu nome e)\s+(?:o|a)?\s*[a-z]{2,}/.test(text);
  return identifiesService && identifiesName;
}
