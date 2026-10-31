import { describe, expect, it } from "vitest";
import { scoreAndRank as legacyRank } from "./legacy-scoring";
import { scoreAndRank, RANKING_VERSION } from "./scoring";
import { composeSession } from "./composition";
import { eligibleCandidates } from "./eligibility";
import { limitPerArtist } from "./candidate-filters";
import { trackFeedbackKey } from "./feedback";
import { HYBRID_BUDGET } from "../application/hybrid-candidates";
import type { UserProfile } from "./taste-profile";
import type { RawCandidate } from "./recommendation.types";
import { mkdirSync, writeFileSync } from "node:fs";

describe("reproducible discovery comparison — synthetic, no provider calls", () => {
  it("compares the same pool/controls before and after feedback; reports invariants separately from taste quality", () => {
    const profile: UserProfile = { topArtistNames: ["Seed"], topGenres: [], knownArtistNames: new Set(), knownTrackKeys: new Set(["band|known"]),
      feedbackMap: new Map(), totalPlays: 100, uniqueArtists: 1 };
    const make = (artistName: string, trackName: string, seedTrack: string): RawCandidate => ({ artistName, trackName, source: "similar_track",
      evidence: [{ kind: "track_similarity", source: "lastfm", seedArtist: "Seed", seedTrack, rank: 1 }] });
    const pool = [make("A Control", "Control", "Other"), make("Z Linked", "Linked", "Reference"), make("Band", "Known", "Other"), make("Band", "Unheard", "Other")];
    const rows: Array<{ treatment: string; legacy: string[]; hybrid: string[] }> = [];
    for (const treatment of ["neutral", "liked-reference", "withdrawn", "disliked-track"]) {
      profile.feedbackMap.clear();
      if (treatment === "liked-reference") profile.feedbackMap.set(trackFeedbackKey("Seed", "Reference"), "LIKED");
      if (treatment === "withdrawn") profile.feedbackMap.set(trackFeedbackKey("Seed", "Reference"), "RETRACTED");
      if (treatment === "disliked-track") profile.feedbackMap.set(trackFeedbackKey("Z Linked", "Linked"), "DISLIKED");
      const legacy = legacyRank(eligibleCandidates(limitPerArtist(pool, 1), profile, new Set()), profile, "BALANCED").slice(0, 3);
      const hybrid = composeSession(scoreAndRank(eligibleCandidates(pool, profile, new Set()), profile, "BALANCED"), 3);
      for (const selected of hybrid) {
        expect(profile.knownTrackKeys.has(selected.artistName.toLowerCase() + "|" + selected.trackName.toLowerCase())).toBe(false);
        expect(profile.feedbackMap.get(trackFeedbackKey(selected.artistName, selected.trackName))).not.toBe("DISLIKED");
      }
      expect(new Set(hybrid.map((item) => item.artistName)).size).toBe(hybrid.length);
      expect(hybrid.some((item) => item.trackName === "Unheard")).toBe(true);
      rows.push({ treatment, legacy: legacy.map((item) => item.trackName), hybrid: hybrid.map((item) => item.trackName) });
    }
    expect(rows[0].hybrid[0]).toBe("Control"); expect(rows[1].hybrid[0]).toBe("Linked"); expect(rows[2].hybrid[0]).toBe("Control");
    expect(rows.every((row) => !row.legacy.includes("Unheard"))).toBe(true);
    const report = { schemaVersion: 1, synthetic: true,
      interpretation: "Mechanism and invariants only; no measured user acceptance or online recommendation-quality claim.",
      control: "legacy ranking and early artist cap on the shared synthetic pool", rankingVersion: RANKING_VERSION,
      controls: { proximity: 55, fame: 50 }, configuredLastFmCallCap: HYBRID_BUDGET.maxCalls,
      invariantViolations: 0, feedbackWinnerChanged: rows[0].hybrid[0] !== rows[1].hybrid[0], rows };
    if (process.env.ARCADIUM_DISCOVERY_REPORT === "true") {
      mkdirSync(".next", { recursive: true });
      writeFileSync(".next/discovery-comparison.json", JSON.stringify(report, null, 2));
      process.stdout.write(JSON.stringify(report) + "\n");
    }
  });
});
