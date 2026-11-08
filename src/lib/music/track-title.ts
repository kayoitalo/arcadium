/**
 * Sufixo de catálogo que só diz a edição ("- 2011 Remaster", "- Remastered 2009")
 * sai da manchete e vira nota ao lado do disco. Versões que mudam a música
 * (ao vivo, demo, acústica) continuam no título.
 */
const REMASTER = /\s+[-–—]\s+((?:\d{4}\s+)?remaster(?:ed)?(?:\s+(?:\d{4}|version))*)\s*$/i;

export function splitTrackTitle(title: string): { title: string; edition: string | null } {
  const match = REMASTER.exec(title);
  const clean = match ? title.slice(0, match.index).trim() : "";
  if (!match || clean.length === 0) return { title, edition: null };
  const year = match[1].match(/\d{4}/)?.[0];
  return { title: clean, edition: year ? `remaster de ${year}` : "remasterizada" };
}
