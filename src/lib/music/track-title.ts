/**
 * Sufixo de catálogo que só diz a edição ("- 2011 Remaster", "- Remastered 2009",
 * "(Deluxe Edition)", "[Remastered]") sai da manchete e vira nota ao lado do
 * disco. Versões que mudam a música (ao vivo, demo, acústica, remix)
 * continuam no título.
 */
const REMASTER = /\s+[-–—]\s+((?:\d{4}\s+)?(?:digital\s+)?remaster(?:ed)?(?:\s+(?:\d{4}|version))*)\s*$/i;
const DASHED = /\s+[-–—]\s+(single version|radio edit|album version|mono|stereo)\s*$/i;
const BRACKETED = /\s*[([]\s*([^()[\]]+?)\s*[)\]]\s*$/;
/** O que, entre parênteses, só diz a edição do disco. */
const EDITION_WORDS = /\b(deluxe|edition|remaster(?:ed)?|bonus(?:\s+track)?|expanded|anniversary|legacy|special|collector'?s|single version|album version|radio edit)\b/i;
/** O que muda a música: fica no título mesmo entre parênteses. */
const CHANGES_THE_MUSIC = /\b(live|ao vivo|demo|acoustic|acústic|remix|mix|instrumental|edit(?!ion)|cover|versão|vivo)\b/i;

function editionNote(suffix: string): string {
  const year = suffix.match(/\d{4}/)?.[0];
  if (/remaster/i.test(suffix)) return year ? `remaster de ${year}` : "remasterizada";
  if (/deluxe/i.test(suffix)) return "edição de luxo";
  if (/anniversary/i.test(suffix)) return "edição comemorativa";
  if (/expanded|bonus/i.test(suffix)) return "edição ampliada";
  if (/single version/i.test(suffix)) return "versão do single";
  if (/radio edit/i.test(suffix)) return "edição pra rádio";
  return "edição especial";
}

export function splitTrackTitle(title: string): { title: string; edition: string | null } {
  const dashed = REMASTER.exec(title) ?? DASHED.exec(title);
  if (dashed) {
    const clean = title.slice(0, dashed.index).trim();
    if (clean.length > 0) return { title: clean, edition: editionNote(dashed[1]) };
    return { title, edition: null };
  }
  const bracketed = BRACKETED.exec(title);
  if (bracketed && EDITION_WORDS.test(bracketed[1]) && !CHANGES_THE_MUSIC.test(bracketed[1])) {
    const clean = title.slice(0, bracketed.index).trim();
    if (clean.length > 0) return { title: clean, edition: editionNote(bracketed[1]) };
  }
  return { title, edition: null };
}

/** Só o nome, sem a edição: para lombada, legenda e qualquer lugar onde o sufixo come o espaço. */
export const cleanTitle = (title: string) => splitTrackTitle(title).title;
