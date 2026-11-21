/** Siglas de gênero: sobem inteiras, senão "mpb" vira "Mpb". */
const ACRONYMS = new Set(["mpb", "edm", "idm", "ebm", "r&b", "rnb", "uk", "nwobhm", "dnb", "ost"]);

/**
 * O gênero como rótulo de lista: o mesmo nome da frase (`genreLabel`), com
 * a primeira letra maiúscula e as siglas inteiras. As fontes misturam caixa
 * ("ROCK", "Alternative Rock", "hip hop"); na tela, todos falam igual:
 * "Rock", "Rock alternativo", "Hip hop", "MPB".
 */
export function formatGenre(genre: string): string {
  const label = genreLabel(genre);
  if (!label) return label;
  return label
    .split(" ")
    .map((word, index) => (ACRONYMS.has(word) ? word.toUpperCase() : index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
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
