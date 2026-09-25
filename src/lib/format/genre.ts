/**
 * Gêneros chegam em caixa baixa das fontes. Capitalizar direto transforma
 * sigla em nome próprio ("mpb" vira "Mpb"), então o que é curto e sem
 * espaço sobe inteiro para caixa alta e o resto vira Título.
 */
export function formatGenre(genre: string): string {
  const trimmed = genre.trim();
  if (!trimmed) return trimmed;
  if (trimmed.length <= 4 && !trimmed.includes(" ")) return trimmed.toUpperCase();
  return trimmed.replace(
    /(^|[\s-])(\p{L})/gu,
    (_, prefix: string, letter: string) => prefix + letter.toUpperCase(),
  );
}

/** O adjetivo que vem antes em inglês e depois em português: "alternative rock" → "rock alternativo". */
const MODIFIERS: Record<string, string> = {
  alternative: "alternativo",
  brazilian: "brasileiro",
  christian: "cristão",
  classic: "clássico",
  experimental: "experimental",
  gothic: "gótico",
  industrial: "industrial",
  instrumental: "instrumental",
  japanese: "japonês",
  korean: "coreano",
  latin: "latino",
  melodic: "melódico",
  progressive: "progressivo",
  psychedelic: "psicodélico",
  southern: "sulista",
  symphonic: "sinfônico",
};

const BASES = new Set(["rock", "pop", "metal", "rap", "punk", "funk", "folk", "jazz", "soul", "hip hop", "trap", "blues", "r&b"]);

/** Gêneros que mudam de nome inteiro. */
const WHOLE: Record<string, string> = {
  classical: "música clássica",
  electronic: "eletrônica",
  electronica: "eletrônica",
  soundtrack: "trilha sonora",
};

/**
 * O gênero do jeito que se fala numa frase: em português quando é assim
 * que se diz ("rock alternativo"), senão como a tag veio, em minúsculas.
 */
export function genreLabel(genre: string): string {
  const tag = genre.trim().toLowerCase().replace(/hip-hop/g, "hip hop");
  if (WHOLE[tag]) return WHOLE[tag];
  const [first, ...rest] = tag.split(" ");
  const base = rest.join(" ");
  if (MODIFIERS[first] && BASES.has(base)) return `${base} ${MODIFIERS[first]}`;
  return tag;
}
