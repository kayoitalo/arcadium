import { limitPerArtist } from "./candidate-filters";
import type { ScoredCandidate } from "./recommendation.types";

/** Exclusions and ranking happen before diversity. Revisits fill a spare slot;
 * they never replace an eligible new track, regardless of their score.
 */
export function composeSession(ranked: ScoredCandidate[], size: number): ScoredCandidate[] {
  const novel = limitPerArtist(ranked.filter((candidate) => !candidate.isRevisit), 1).slice(0, size);
  if (novel.length >= size) return novel;
  const artists = new Set(novel.map((candidate) => candidate.artistName.toLowerCase()));
  const revisit = ranked.find((candidate) => candidate.isRevisit && !artists.has(candidate.artistName.toLowerCase()));
  return revisit ? [...novel, revisit] : novel;
}
