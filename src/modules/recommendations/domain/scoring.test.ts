import { describe, it, expect } from "vitest";
import { computeComponents, calculateScore, scoreAndRank, type UserProfile } from "./legacy-scoring";
import { type RawCandidate } from "./recommendation.types";

describe("Recommendation Scoring Engine", () => {
  const mockProfile: UserProfile = {
    topArtistNames: ["Deftones", "Gojira", "Radiohead"],
    topGenres: ["alternative metal", "progressive metal", "rock"],
    knownArtistNames: new Set(["deftones", "gojira", "radiohead", "muse"]),
    knownTrackKeys: new Set(["deftones|change", "gojira|stranded"]),
    feedbackMap: new Map([
      [JSON.stringify(["muse", "hysteria"]), "DISLIKED"],
      [JSON.stringify(["mastodon", "blood and thunder"]), "LIKED"],
    ]),
    totalPlays: 100,
    uniqueArtists: 4,
  };

  describe("computeComponents", () => {
    it("penalizes novelty if track is already known", () => {
      const candidate: RawCandidate = {
        artistName: "Deftones",
        trackName: "Change",
        source: "similar_artist",
      };

      const components = computeComponents(candidate, mockProfile);
      expect(components.noveltyFit).toBe(0.0);
    });

    it("rewards feedbackFit for the individually liked track", () => {
      const candidate: RawCandidate = {
        artistName: "Mastodon",
        trackName: "Blood and Thunder",
        source: "similar_artist",
      };

      const components = computeComponents(candidate, mockProfile);
      expect(components.feedbackFit).toBe(0.9);
    });

    it("penalizes feedbackFit for the individually disliked track", () => {
      const candidate: RawCandidate = {
        artistName: "Muse",
        trackName: "Hysteria",
        source: "similar_artist",
      };

      const components = computeComponents(candidate, mockProfile);
      expect(components.feedbackFit).toBe(0.0);
    });
    it("does not transfer a rejection to another song, live version, artist seed or genre", () => {
      for (const candidate of [
        { artistName: "Muse", trackName: "Starlight", source: "similar_artist" as const },
        { artistName: "Muse", trackName: "Hysteria (Live)", source: "similar_artist" as const },
        { artistName: "Other", trackName: "Song", sourceArtistName: "Muse", source: "similar_artist" as const },
      ]) expect(computeComponents(candidate, mockProfile).feedbackFit).toBe(0.5);
    });

    it("computes genre similarity correctly", () => {
      const candidate: RawCandidate = {
        artistName: "Tool",
        trackName: "Schism",
        genre: "progressive metal / alternative metal",
        source: "genre_adjacency",
      };

      const components = computeComponents(candidate, mockProfile);

      expect(components.genreSimilarity).toBeGreaterThan(0.8);
    });
  });

  describe("calculateScore", () => {
    it("calculates a score between 0 and 100", () => {
      const components = {
        artistSimilarity: 0.8,
        genreSimilarity: 0.9,
        profileRelevance: 0.7,
        noveltyFit: 1.0,
        feedbackFit: 0.5,
        metadataConfidence: 1.0,
        proximityFit: 0.6,
        fameFit: 0.4,
      };

      const scoreSafe = calculateScore(components, "SAFE");
      const scoreExperimental = calculateScore(components, "EXPERIMENTAL");

      expect(scoreSafe).toBeGreaterThanOrEqual(0);
      expect(scoreSafe).toBeLessThanOrEqual(100);
      expect(scoreExperimental).toBeGreaterThanOrEqual(0);
      expect(scoreExperimental).toBeLessThanOrEqual(100);

      expect(scoreSafe).not.toEqual(scoreExperimental);
    });
  });

  describe("scoreAndRank", () => {
    it("ranks candidates and adds reasons", () => {
      const candidates: RawCandidate[] = [
        {
          artistName: "Tool",
          trackName: "Schism",
          genre: "progressive metal",
          source: "similar_artist",
          sourceArtistName: "Gojira",
        },
        {
          artistName: "Deftones",
          trackName: "Change",
          source: "top_artist_deep_cut",
          sourceArtistName: "Deftones",
        },
      ];

      const ranked = scoreAndRank(candidates, mockProfile, "BALANCED");

      expect(ranked).toHaveLength(2);
      expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
      // o motivo precisa dizer de onde a sugestão veio, não repetir a nota
      expect(ranked[0].reason).toContain("Gojira");
      expect(ranked[0].reason).not.toMatch(/^Match/);
      expect(ranked[0].noveltyScore).toBeDefined();
    });
  });
});
