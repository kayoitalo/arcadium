import type { SimilarArtistProvider } from "../domain/similar-artist-provider.interface";
import type { RawCandidate, RecommendationEvidence } from "../domain/recommendation.types";
import { representativeArtists, type UserProfile } from "../domain/taste-profile";
import { trackFeedbackKey } from "../domain/feedback";
import { sameRecordingText } from "@/lib/music/recording-match";

/** Logical calls, cache misses can only reduce actual requests. Hybrid artwork
 * reuses Apple previews/local catalog, without extra Last.fm requests.
 */
export const HYBRID_BUDGET = { artistSeeds: 3, trackSeeds: 4, artistsWithTracks: 6, reachArtists: 6, maxCalls: 19 } as const;

export function mergeCandidates(candidates: RawCandidate[]): RawCandidate[] {
  const merged = new Map<string, RawCandidate>();
  for (const candidate of candidates) {
    const key = trackFeedbackKey(candidate.artistName, candidate.trackName);
    const previous = merged.get(key);
    if (!previous) { merged.set(key, { ...candidate, evidence: [...(candidate.evidence ?? [])] }); continue; }
    const evidence = [...(previous.evidence ?? []), ...(candidate.evidence ?? [])];
    const unique = [...new Map(evidence.map((entry) => [JSON.stringify(entry), entry])).values()].slice(0, 8);
    merged.set(key, { ...previous, genre: previous.genre || candidate.genre, artistId: previous.artistId || candidate.artistId,
      trackId: previous.trackId || candidate.trackId, listeners: previous.listeners ?? candidate.listeners, evidence: unique,
      isRevisit: previous.isRevisit || candidate.isRevisit });
  }
  return [...merged.values()];
}

export async function hybridExternalCandidates(provider: SimilarArtistProvider, profile: UserProfile): Promise<RawCandidate[]> {
  if (!provider.isConfigured()) return [];
  provider.beginDiscoveryWindow?.(20_000);
  const artistSeeds = representativeArtists(profile, HYBRID_BUDGET.artistSeeds);
  const trackSeeds = (profile.trackSeeds ?? []).slice(0, HYBRID_BUDGET.trackSeeds);
  const candidates: RawCandidate[] = [];
  const [artistLists, trackLists] = await Promise.all([
    Promise.all(artistSeeds.map(async (seed) => ({ seed, artists: await provider.getSimilarArtists(seed.name, 12).catch(() => []) }))),
    Promise.all(trackSeeds.map(async (seed) => ({ seed,
      tracks: provider.getSimilarTracks ? await provider.getSimilarTracks(seed.artistName, seed.trackName, 12).catch(() => []) : [] }))),
  ]);
  for (const { seed, tracks } of trackLists) for (const track of tracks) {
    candidates.push({ artistName: track.artistName, trackName: track.trackName, source: "similar_track",
      sourceArtistName: seed.artistName, evidence: [{ kind: "track_similarity", source: "lastfm",
        seedArtist: seed.artistName, seedTrack: seed.trackName, region: seed.region, rank: track.rank, rawMatch: track.rawMatch }] });
  }
  const picks: Array<{ name: string; evidence: RecommendationEvidence }> = [];
  const names = new Set<string>();
  if (artistSeeds[0]) {
    picks.push({ name: artistSeeds[0].name, evidence: { kind: "artist_catalog", source: "lastfm", seedArtist: artistSeeds[0].name, region: artistSeeds[0].region } });
    names.add(artistSeeds[0].name.toLowerCase());
  }
  // Round robin prevents a single successful seed from consuming all top-track lookups.
  for (let rank = 0; rank < 12 && picks.length < HYBRID_BUDGET.artistsWithTracks; rank++) {
    for (const { seed, artists } of artistLists) {
      const artist = artists[rank];
      if (!artist || names.has(artist.name.toLowerCase()) || picks.length >= HYBRID_BUDGET.artistsWithTracks) continue;
      names.add(artist.name.toLowerCase());
      picks.push({ name: artist.name, evidence: { kind: "artist_similarity", source: "lastfm", seedArtist: seed.name,
        region: seed.region, rank: rank + 1, rawMatch: artist.rawMatch } });
    }
  }
  const trackOptions = await Promise.all(picks.map(async (pick) => ({ pick, tracks: await provider.getTopTracks(pick.name, 3).catch(() => []) })));
  for (const { pick, tracks } of trackOptions) for (const [index, track] of tracks.entries()) {
    if (!sameRecordingText(pick.name, track.artistName)) continue;
    candidates.push({
    artistName: track.artistName, trackName: track.trackName, source: pick.evidence.kind === "artist_catalog" ? "top_artist_deep_cut" : "similar_artist",
    sourceArtistName: pick.evidence.seedArtist, evidence: [pick.evidence], providerRank: index + 1,
    });
  }
  const reachNames = [...new Set(candidates.map((candidate) => candidate.artistName))].slice(0, HYBRID_BUDGET.reachArtists);
  const reaches = new Map(await Promise.all(reachNames.map(async (name) => [name,
    await provider.getArtistReach(name).catch(() => null)] as const)));
  return mergeCandidates(candidates).map((candidate) => ({ ...candidate, listeners: reaches.get(candidate.artistName)?.listeners }));
}
