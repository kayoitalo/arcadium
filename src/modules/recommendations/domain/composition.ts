import { limitPerArtist } from "./candidate-filters";
import type { ScoredCandidate } from "./recommendation.types";

/** Exclusions and ranking happen before diversity. Revisits fill a spare slot;
 * they never replace an eligible new track, regardless of their score.
 */
export function composeSession(ranked: ScoredCandidate[], size: number): ScoredCandidate[] {
  if (size <= 0) return [];
  // Different artists can all come from the same reference. A single liked
  // track must not turn the entire session into its similarity list.
  const perReference = Math.min(size, Math.max(2, Math.ceil(size / 3)));
  const counts = new Map<string, number>();
  const novel: ScoredCandidate[] = [];
  for (const candidate of limitPerArtist(ranked.filter((item) => !item.isRevisit), 1)) {
    const references = [...new Set((candidate.evidence ?? []).flatMap((entry) =>
      entry.seedArtist ? [JSON.stringify([entry.seedArtist.toLowerCase(), entry.seedTrack?.toLowerCase() ?? null])] : []))];
    const available = references.find((key) => (counts.get(key) ?? 0) < perReference);
    if (references.length && !available) continue;
    if (available) counts.set(available, (counts.get(available) ?? 0) + 1);
    novel.push(candidate);
    if (novel.length >= size) break;
  }
  if (novel.length >= size) return novel;
  const artists = new Set(novel.map((candidate) => candidate.artistName.toLowerCase()));
  const revisit = ranked.find((candidate) => candidate.isRevisit && !artists.has(candidate.artistName.toLowerCase()));
  return revisit ? [...novel, revisit] : novel;
}
