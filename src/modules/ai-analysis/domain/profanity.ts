/**
 * Palavrão leve deixa o texto com cara de conversa entre amigos, mas na
 * tela ele aparece sempre censurado: "FO***SE". O prompt já pede assim;
 * esta função garante quando o modelo esquece.
 */
const PROFANITY = /\b(f[o0]d[aeiu][-\s]?se|f[o0]d[aeiu]\w*|p[o0]rr[ao]\w*|caralh[oa]\w*|merd[ao]\w*|put[ao]\s+que\s+pariu|cacet[ea]\w*|bost[ao]\w*)\b/gi;

function mask(word: string): string {
  // palavra já censurada pelo modelo fica como está
  if (word.includes("*")) return word;
  const letters = [...word];
  // curta demais para mostrar início e fim sem continuar legível
  if (letters.length <= 5) return letters[0] + "*".repeat(letters.length - 1);
  const keep = 2;
  return letters.slice(0, keep).join("") + "*".repeat(letters.length - keep * 2) + letters.slice(-keep).join("");
}

export function censorProfanity(text: string): string;
export function censorProfanity(text: null | undefined): null;
export function censorProfanity(text: string | null | undefined): string | null;
export function censorProfanity(text: string | null | undefined): string | null {
  if (!text) return text ?? null;
  return text.replace(PROFANITY, (word) => mask(word));
}
