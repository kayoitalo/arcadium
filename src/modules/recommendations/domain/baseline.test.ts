import { describe, expect, it } from "vitest";
import { scoreAndRank, type UserProfile } from "./scoring";
import { ALGORITHM_VERSION, type RawCandidate } from "./recommendation.types";

// A synthetic control, not the owner's history. Intentionally captures current heuristics.
const profile: UserProfile = {
  topArtistNames: ["Radiohead", "Deftones"], topGenres: ["alternative rock", "alternative metal"],
  knownArtistNames: new Set(["radiohead", "deftones"]), knownTrackKeys: new Set(),
  feedbackMap: new Map(), totalPlays: 100, uniqueArtists: 2,
};
const candidates: RawCandidate[] = [
  { artistName: "Portishead", trackName: "Roads", source: "similar_artist", sourceArtistName: "Radiohead", match: 0.8, listeners: 1000000 },
  { artistName: "Hum", trackName: "Stars", genre: "alternative rock", source: "similar_artist", sourceArtistName: "Deftones", match: 0.5, listeners: 100000 },
  { artistName: "Radiohead", trackName: "Separator", genre: "alternative rock", source: "top_artist_deep_cut", sourceArtistName: "Radiohead" },
];

describe("v2-dials synthetic evaluation control", () => {
  it("records a reproducible control for safe, balanced and experimental ranking", () => {
    const result = ["SAFE", "BALANCED", "EXPERIMENTAL"].map(mode => ({ mode,
      items: scoreAndRank(candidates, profile, mode as "SAFE" | "BALANCED" | "EXPERIMENTAL")
        .map(item => ({ artist: item.artistName, score: item.score, novelty: item.noveltyScore })),
    }));
    expect(result.map(row => [row.mode, row.items.map(item => [item.artist, item.score, item.novelty])])).toEqual([
      ["SAFE", [["Hum", 81, 90], ["Portishead", 79, 90], ["Radiohead", 78, 30]]],
      ["BALANCED", [["Hum", 89, 90], ["Portishead", 72, 90], ["Radiohead", 71, 30]]],
      ["EXPERIMENTAL", [["Hum", 80, 90], ["Portishead", 64, 90], ["Radiohead", 60, 30]]],
    ]);
    if (process.env.ARCADIUM_BASELINE_REPORT === "true") console.log(JSON.stringify({ algorithmVersion: ALGORITHM_VERSION, synthetic: true, result }));
  });
});
