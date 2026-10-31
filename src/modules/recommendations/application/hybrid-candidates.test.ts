import { describe, expect, it, vi } from "vitest";
import { hybridExternalCandidates, mergeCandidates, HYBRID_BUDGET } from "./hybrid-candidates";
import type { UserProfile } from "../domain/taste-profile";
const profile: UserProfile = { topArtistNames: ["A", "B", "C"], topGenres: [], knownArtistNames: new Set(), knownTrackKeys: new Set(),
  feedbackMap: new Map(), totalPlays: 100, uniqueArtists: 3,
  trackSeeds: Array.from({ length: 4 }, (_, index) => ({ artistName: "Seed " + index, trackName: "Song " + index, plays: 1, region: "long_term" })) };
describe("bounded candidate generation", () => {
  it("keeps the complete logical budget below 20 while retaining three options per artist", async () => {
    const provider = { isConfigured: () => true,
      getSimilarArtists: vi.fn(async (name: string) => Array.from({ length: 12 }, (_, index) => ({ name: name + index, match: .8 }))),
      getSimilarTracks: vi.fn(async (artist: string) => [{ artistName: artist + " neighbor", trackName: "Specific", rank: 1, rawMatch: 10.95 }]),
      getTopTracks: vi.fn(async (artistName: string) => ["One", "Two", "Three"].map((trackName) => ({ artistName, trackName }))),
      getArtistReach: vi.fn(async () => ({ listeners: 1000 })),
    };
    const result = await hybridExternalCandidates(provider, profile);
    const count = provider.getSimilarArtists.mock.calls.length + provider.getSimilarTracks.mock.calls.length
      + provider.getTopTracks.mock.calls.length + provider.getArtistReach.mock.calls.length;
    expect(count).toBe(HYBRID_BUDGET.maxCalls);
    expect(provider.getTopTracks).toHaveBeenCalledWith(expect.any(String), 3);
    expect(result.filter((item) => item.source === "similar_artist" || item.source === "top_artist_deep_cut")).toHaveLength(18);
    expect(result.some((item) => item.source === "top_artist_deep_cut")).toBe(true);
    expect(result.find((item) => item.source === "similar_track")?.evidence?.[0].rawMatch).toBe(10.95);
    const measured = provider.getArtistReach.mock.calls as unknown as string[][];
    expect(measured.map(([name]) => name)).toEqual(["A", "Seed 0 neighbor", "A0", "Seed 1 neighbor", "B0", "Seed 2 neighbor"]);
  });
  it("merges the same track's sources without conflating remixes or summing provider scores", () => {
    const one = { artistName: "Band", trackName: "Song", source: "similar_track" as const, evidence: [{ kind: "track_similarity" as const, source: "lastfm" as const, rawMatch: 10.95 }] };
    const two = { ...one, evidence: [{ ...one.evidence[0], rawMatch: .4 }] };
    const result = mergeCandidates([one, two, { ...one, trackName: "Song (Remix)" }]);
    expect(result).toHaveLength(2); expect(result[0].evidence?.map((entry) => entry.rawMatch)).toEqual([10.95, .4]);
    expect(result[0].match).toBeUndefined();
  });
  it("degrades locally when no provider is configured, without calling it", async () => {
    const provider = { isConfigured: () => false, getSimilarArtists: vi.fn(), getTopTracks: vi.fn(), getArtistReach: vi.fn() };
    expect(await hybridExternalCandidates(provider, profile)).toEqual([]);
    expect(provider.getSimilarArtists).not.toHaveBeenCalled();
  });
});
