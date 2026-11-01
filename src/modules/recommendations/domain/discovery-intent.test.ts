import { describe, expect, it, vi } from "vitest";
import { readDiscoveryContext, repertoireCandidates } from "./discovery-intent";
import { sessionRequest } from "./contracts";
import { eligibleCandidates } from "./eligibility";
import { scoreAndRank, type UserProfile } from "./scoring";
import { composeSession } from "./composition";
import { hybridExternalCandidates } from "../application/hybrid-candidates";
import { trackFeedbackKey } from "./feedback";

const profile = (): UserProfile => ({ topArtistNames: [], topGenres: [], knownArtistNames: new Set(),
  knownTrackKeys: new Set(), feedbackMap: new Map(), totalPlays: 0, uniqueArtists: 0 });

describe("discovery intentions and focused journeys", () => {
  it("requires an owned-session reference and an idempotency key in the deepen contract", () => {
    const input = { operation: "DEEPEN", sessionId: "s", sourceItemId: "item", requestKey: crypto.randomUUID() };
    expect(sessionRequest.safeParse(input).success).toBe(true);
    for (const field of ["sessionId", "sourceItemId", "requestKey"]) expect(sessionRequest.safeParse({ ...input, [field]: undefined }).success).toBe(false);
    expect(sessionRequest.safeParse({ ...input, operation: "NEW_ENTRY" }).success).toBe(false);
    expect(sessionRequest.safeParse({ intent: "HAPPY_MOOD" }).success).toBe(false);
  });
  it("keeps unknown or malformed legacy intent unspecified", () => {
    expect(readDiscoveryContext(null)).toBeNull();
    expect(readDiscoveryContext({ intent: "DISCOVER" })).toBeNull();
    expect(readDiscoveryContext({ version: 1, intent: "REPERTOIRE", journey: { action: "ENTRY" } })?.intent).toBe("REPERTOIRE");
  });
  it("builds repertoire only from observed tracks, preserving versions and truthful play counts", () => {
    const p = profile(); p.likedTracks = [{ artistName: "Unheard", trackName: "Curiosity" }];
    p.longTerm = { artists: [], genres: [], totalPlays: 5, genreCoverage: 0, tracks: [
      { artistName: "Band", trackName: "Song (Live)", plays: 2, region: "long_term" },
      { artistName: "Other", trackName: "Song", plays: 3, region: "long_term" },
      { artistName: "No events", trackName: "Unknown", plays: 0, region: "long_term" },
    ] };
    const candidates = repertoireCandidates(p);
    expect(candidates).toHaveLength(2);
    expect(candidates[1]).toMatchObject({ trackName: "Song (Live)", evidence: [{ playCount: 2, source: "history" }] });
    expect(candidates.some((item) => item.artistName === "Unheard")).toBe(false);
  });
  it("allows known repertoire but still excludes current dislike and recent exposure", () => {
    const p = profile();
    p.knownTrackKeys = new Set(["a|one", "b|two", "c|three"]);
    const candidates = ["A", "B", "C"].map((artistName, i) => ({ artistName, trackName: ["One", "Two", "Three"][i], source: "history_repertoire" as const }));
    p.feedbackMap.set(trackFeedbackKey("B", "Two"), "DISLIKED");
    expect(eligibleCandidates(candidates, p, new Set())).toHaveLength(0);
    expect(eligibleCandidates(candidates, p, new Set(["c|three"]), true).map((c) => c.artistName)).toEqual(["A"]);
  });
  it("uses only the requested track as a seed within seven calls and does not fill from unrelated references", async () => {
    const provider = { isConfigured: () => true, beginDiscoveryWindow: vi.fn(), getSimilarArtists: vi.fn(), getTopTracks: vi.fn(),
      getArtistReach: vi.fn().mockResolvedValue(null), getSimilarTracks: vi.fn().mockResolvedValue(Array.from({ length: 20 }, (_, i) => ({ artistName: `Band ${i}`, trackName: `New ${i}`, rank: i + 1 }))) };
    const p = profile(); p.topArtistNames = ["Unrelated"]; p.trackSeeds = [{ artistName: "Unrelated", trackName: "Other", plays: 10, region: "long_term" }];
    const result = await hybridExternalCandidates(provider, p, { artistName: "Anchor", trackName: "Original (Live)" });
    expect(provider.getSimilarTracks).toHaveBeenCalledExactlyOnceWith("Anchor", "Original (Live)", 12);
    expect(provider.getArtistReach).toHaveBeenCalledTimes(6);
    expect(provider.getSimilarArtists).not.toHaveBeenCalled(); expect(provider.getTopTracks).not.toHaveBeenCalled();
    expect(result.every((item) => item.evidence?.[0].seedTrack === "Original (Live)" && item.evidence[0].region === undefined)).toBe(true);
    const ranked = scoreAndRank(result, p, "BALANCED");
    expect(composeSession(ranked, 8)).toHaveLength(3);
    expect(composeSession(ranked, 8, true)).toHaveLength(8);
    provider.getSimilarTracks.mockResolvedValue([]);
    expect(await hybridExternalCandidates(provider, p, { artistName: "Anchor", trackName: "Empty" })).toEqual([]);
  });
  it("keeps an explicitly chosen relation explainable without turning it into a like", () => {
    const p = profile(); p.feedbackMap.set(trackFeedbackKey("Anchor", "Song"), "DISLIKED");
    p.explicitReference = { artistName: "Anchor", trackName: "Song" };
    const [candidate] = scoreAndRank([{ artistName: "New", trackName: "Other", source: "similar_track", evidence: [
      { kind: "track_similarity", source: "lastfm", seedArtist: "Anchor", seedTrack: "Song", rank: 1 },
    ] }], p, "BALANCED");
    expect(candidate.reason).toContain('“Song”');
    expect(candidate.reason).not.toContain('Você marcou essa referência como');
    expect(p.feedbackMap.get(trackFeedbackKey("Anchor", "Song"))).toBe("DISLIKED");
  });
});
