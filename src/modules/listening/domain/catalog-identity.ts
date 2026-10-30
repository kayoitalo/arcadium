import { normalizeText } from "./normalization";

/** Unknown identity has its own bucket; a name never overwrites a known MBID. */
export function catalogIdentityKey(name: string, mbid?: string | null): string {
  return JSON.stringify([normalizeText(name), mbid || null]);
}

/** Known MBIDs must agree. Without one, reuse a unique name bucket only as
 * provisional grouping, never as confirmation of identity or a new identifier.
 */
export function catalogMatch<T extends { normalizedName: string; mbid?: string | null }>(
  candidates: T[], name: string, mbid?: string,
): T | undefined {
  const named = candidates.filter((candidate) => candidate.normalizedName === normalizeText(name));
  const exact = named.filter((candidate) => (candidate.mbid || undefined) === (mbid || undefined));
  if (exact.length === 1) return exact[0];
  return !mbid && named.length === 1 ? named[0] : undefined;
}
