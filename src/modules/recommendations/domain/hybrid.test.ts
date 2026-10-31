import { describe, expect, it } from "vitest";
import { tasteSlice, representativeTracks, representativeArtists, type UserProfile } from "./taste-profile";
import { scoreAndRank, computeComponents } from "./scoring";
import { composeSession } from "./composition";
import { eligibleCandidates } from "./eligibility";
import { trackFeedbackKey } from "./feedback";
import type { RawCandidate } from "./recommendation.types";
export const profile = (): UserProfile => ({ topArtistNames: ["Seed"], topGenres: ["rock"], knownArtistNames: new Set(["seed"]),
  knownTrackKeys: new Set(), feedbackMap: new Map(), totalPlays: 100, uniqueArtists: 1, referenceTime: "2026-10-30T12:00:00Z" });
const candidate = (artistName: string, trackName: string): RawCandidate => ({ artistName, trackName, source: "similar_track",
  evidence: [{ kind: "track_similarity", source: "lastfm", seedArtist: "Seed", seedTrack: "Reference", region: "long_term", rank: 1 }] });
describe("multidimensional profile", () => {
  it("weights genre contribution by actual plays, dividing multiple tags instead of counting artists equally", () => {
    const slice = tasteSlice([{ name: "A", plays: 90 }, { name: "B", plays: 10 }], [], new Map([["a", ["rock", "metal"]], ["b", ["jazz"]]]));
    expect(Object.fromEntries(slice.genres.map((genre) => [genre.name, genre.share]))).toEqual({ rock: .45, metal: .45, jazz: .1 });
    expect(slice.genreCoverage).toBe(1);
    expect(tasteSlice([{ name: "Unknown", plays: 10 }], [], new Map()).genres).toEqual([]);
  });
  it("keeps recent and durable regions separate and selects distinct references including explicit likes", () => {
    const long = tasteSlice([{ name: "Old", plays: 100 }], [{ artistName: "Old", trackName: "Old Song", plays: 100, region: "long_term" }], new Map());
    const recent = tasteSlice([{ name: "New", plays: 10 }], [{ artistName: "New", trackName: "New Song", plays: 10, region: "recent" }], new Map());
    const seeds = representativeTracks(long, recent, [{ artistName: "Liked", trackName: "Liked Song" }], new Map());
    expect(new Set(seeds.map((seed) => seed.region))).toEqual(new Set(["long_term", "recent", "feedback"]));
    const p = { ...profile(), longTerm: long, recent, likedTracks: [{ artistName: "Liked", trackName: "Liked Song" }] };
    expect(representativeArtists(p).map((artist) => artist.name)).toEqual(["New", "Old"]);
    const rejected = new Map([[trackFeedbackKey("Liked", "Liked Song"), "DISLIKED" as const]]);
    expect(representativeTracks(long, recent, p.likedTracks, rejected).some((seed) => seed.artistName === "Liked")).toBe(false);
  });
});
describe("selection and learning with fixed input", () => {
  it("feedback changes the next choice through an evidenced track connection and withdrawal reverses it", () => {
    const p = profile();
    const linked = candidate("Z Linked", "Linked Song");
    const independent = { ...candidate("A Control", "Control Song"), evidence: [{ ...candidate("x", "y").evidence![0], seedTrack: "Other" }] };
    const choose = () => composeSession(scoreAndRank([linked, independent], p, "BALANCED"), 1)[0].trackName;
    expect(choose()).toBe("Control Song");
    p.feedbackMap.set(trackFeedbackKey("Seed", "Reference"), "LIKED");
    expect(choose()).toBe("Linked Song");
    p.feedbackMap.set(trackFeedbackKey("Seed", "Reference"), "RETRACTED");
    expect(choose()).toBe("Control Song");
    p.feedbackMap.set(trackFeedbackKey("Seed", "Reference"), "DISLIKED");
    expect(choose()).toBe("Control Song");
    expect(scoreAndRank([linked, independent], p, "BALANCED").find((item) => item.trackName === "Control Song")?.components.feedbackFit).toBe(.5);
  });
  it("excludes a known or rejected first track before limiting the artist, preserving the second option", () => {
    const p = profile(); p.knownTrackKeys.add("band|first");
    const options = [candidate("Band", "First"), candidate("Band", "Second"), candidate("Other", "Third")];
    const select = () => composeSession(scoreAndRank(eligibleCandidates(options, p, new Set()), p, "BALANCED"), 8);
    expect(select().some((item) => item.trackName === "Second")).toBe(true);
    p.feedbackMap.set(trackFeedbackKey("Band", "Second"), "DISLIKED");
    expect(select().map((item) => item.trackName)).toEqual(["Third"]);
    expect(eligibleCandidates([candidate("Band", "Fourth")], p, new Set())).toHaveLength(1);
  });
  it("does not treat absent popularity or attributes as obscurity, mood or musical facts", () => {
    const p = profile(); const unknown = candidate("Unknown", "Song");
    const result = scoreAndRank([unknown], p, "EXPERIMENTAL", { proximity: 25, fame: 0 })[0];
    expect(result.position).toBeNull(); expect(result.components.fameFit).toBe(.5);
    expect(result.reason).not.toMatch(/ninguém|obscur|feliz|melancólic|vocal|bpm|segura|probabilidade/i);
    p.feedbackMap.set(trackFeedbackKey("Unknown", "Song"), "REQUEST_MISMATCH");
    expect(computeComponents(unknown, p).feedbackFit).toBe(.5);
  });
  it("shrinks sparse genre evidence toward neutral instead of confidently extrapolating it", () => {
    const p = profile();
    const complete = tasteSlice([{ name: "Known", plays: 100 }], [], new Map([["known", ["rock"]]]));
    p.longTerm = complete; p.recent = complete;
    const track = { ...candidate("Band", "Song"), genre: "rock" };
    const full = computeComponents(track, p).genreSimilarity;
    const sparse = tasteSlice([{ name: "Known", plays: 1 }, { name: "Unknown", plays: 99 }], [], new Map([["known", ["rock"]]]));
    p.longTerm = sparse; p.recent = sparse;
    expect(Math.abs(computeComponents(track, p).genreSimilarity - .5)).toBeLessThan(Math.abs(full - .5));
  });
  it("only admits documented revisits and never lets them replace a new track", () => {
    const p = profile(); p.knownTrackKeys.add("old|song");
    const revisit: RawCandidate = { artistName: "Old", trackName: "Song", source: "history_revisit", isRevisit: true,
      evidence: [{ kind: "history_revisit", source: "history", lastPlayedAt: "2024-01-01T00:00:00Z", playCount: 5 }] };
    expect(eligibleCandidates([{ ...revisit, evidence: [] }], p, new Set())).toEqual([]);
    const ranked = scoreAndRank(eligibleCandidates([revisit, candidate("New", "Fresh")], p, new Set()), p, "SAFE");
    expect(composeSession(ranked, 1)[0].trackName).toBe("Fresh");
    expect(composeSession(ranked, 2)[1].reason).toContain("Revisita");
  });
});
