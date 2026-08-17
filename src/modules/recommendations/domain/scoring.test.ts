import { describe, it, expect } from "vitest";
import { computeComponents, calculateScore, scoreAndRank, type UserProfile } from "./scoring";
import { type RawCandidate } from "./recommendation.types";

describe("Recommendation Scoring Engine", () => {
  const mockProfile: UserProfile = {
    topArtistNames: ["Deftones", "Gojira", "Radiohead"],
    topGenres: ["alternative metal", "progressive metal", "rock"],
    knownArtistNames: new Set(["deftones", "gojira", "radiohead", "muse"]),
    knownTrackKeys: new Set(["deftones|change", "gojira|stranded"]),
    feedbackMap: new Map([
      ["muse", "DISLIKED"],
      ["mastodon", "LIKED"],
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

    it("rewards feedbackFit if artist is liked", () => {
      const candidate: RawCandidate = {
        artistName: "Mastodon",
        trackName: "Blood and Thunder",
        source: "similar_artist",
      };

      const components = computeComponents(candidate, mockProfile);
      expect(components.feedbackFit).toBe(0.9);
    });

    it("penalizes feedbackFit if artist is disliked", () => {
      const candidate: RawCandidate = {
        artistName: "Muse",
        trackName: "Hysteria",
        source: "similar_artist",
      };

      const components = computeComponents(candidate, mockProfile);
      expect(components.feedbackFit).toBe(0.0);
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
      expect(ranked[0].reason).toContain("Match determinístico");
      expect(ranked[0].noveltyScore).toBeDefined();
    });
  });
});
