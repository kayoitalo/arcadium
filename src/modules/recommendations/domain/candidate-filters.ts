/** Separadores usados por provedores para creditar colaborações. */
const COLLABORATION_SPLIT = /\s*(?:&|\bfeat\.?\b|\bfeaturing\b|\bwith\b|\bvs\.?\b|\bx\b|,|\/)\s*/i;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * "Michael Jackson & Justin Timberlake" não é um artista novo para quem
 * já ouve Michael Jackson — é o mesmo artista com um convidado. Sem este
 * filtro, uma colaboração entra na sessão marcada como descoberta.
 */
export function isCollaborationOfKnownArtist(
  artistName: string,
  knownArtistNames: Set<string>,
): boolean {
  const normalized = normalize(artistName);
  if (knownArtistNames.has(normalized)) return true;

  const parts = normalized.split(COLLABORATION_SPLIT).map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return false;

  return parts.some((part) => knownArtistNames.has(part));
}

/**
 * Mantém no máximo `perArtist` faixas do mesmo artista, preservando a
 * ordem recebida. Sem isso, dois singles do mesmo nome ocupam metade da
 * sessão e a variedade morre.
 */
export function limitPerArtist<T extends { artistName: string }>(
  candidates: T[],
  perArtist: number,
): T[] {
  const counts = new Map<string, number>();
  const kept: T[] = [];

  for (const candidate of candidates) {
    const key = normalize(candidate.artistName);
    const seen = counts.get(key) ?? 0;
    if (seen >= perArtist) continue;
    counts.set(key, seen + 1);
    kept.push(candidate);
  }

  return kept;
}
