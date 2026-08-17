

export type RecommendationMode = "SAFE" | "BALANCED" | "EXPERIMENTAL";
export type RecommendationContext = "GENERAL" | "WORKING" | "STUDYING" | "EXERCISING" | "RELAXING";

export type FeedbackType = "LIKED" | "DISLIKED" | "ALREADY_KNOW" | "NOT_INTERESTED" | "SAVE_FOR_LATER";

export interface ScoreComponents {
  artistSimilarity: number;
  genreSimilarity: number;
  profileRelevance: number;
  noveltyFit: number;
  feedbackFit: number;
  metadataConfidence: number;
}

export const MODE_WEIGHTS: Record<RecommendationMode, ScoreComponents> = {
  SAFE: {
    artistSimilarity: 0.35,
    genreSimilarity: 0.25,
    profileRelevance: 0.20,
    noveltyFit: 0.05,
    feedbackFit: 0.10,
    metadataConfidence: 0.05,
  },
  BALANCED: {
    artistSimilarity: 0.28,
    genreSimilarity: 0.24,
    profileRelevance: 0.18,
    noveltyFit: 0.14,
    feedbackFit: 0.10,
    metadataConfidence: 0.06,
  },
  EXPERIMENTAL: {
    artistSimilarity: 0.15,
    genreSimilarity: 0.15,
    profileRelevance: 0.15,
    noveltyFit: 0.30,
    feedbackFit: 0.15,
    metadataConfidence: 0.10,
  },
};

export const FEEDBACK_RULES: Record<FeedbackType, {
  trackEffect: number;
  artistEffect: number;
  genreEffect: number;
  cooldownDays: number | null;
}> = {
  LIKED: { trackEffect: 0.20, artistEffect: 0.10, genreEffect: 0.04, cooldownDays: null },
  DISLIKED: { trackEffect: -1.0, artistEffect: -0.14, genreEffect: -0.04, cooldownDays: 90 },
  ALREADY_KNOW: { trackEffect: -1.0, artistEffect: 0, genreEffect: 0, cooldownDays: null },
  NOT_INTERESTED: { trackEffect: -0.20, artistEffect: -0.05, genreEffect: -0.01, cooldownDays: 30 },
  SAVE_FOR_LATER: { trackEffect: 0, artistEffect: 0.01, genreEffect: 0, cooldownDays: null },
};

export interface RawCandidate {
  artistName: string;
  trackName: string;
  albumName?: string;
  genre?: string;
  source: "similar_artist" | "genre_adjacency" | "artist_graph" | "top_artist_deep_cut";
  sourceArtistName?: string;
  artistId?: string;
  trackId?: string;
}

export interface ScoredCandidate extends RawCandidate {
  score: number;
  noveltyScore: number;
  components: ScoreComponents;
  reason: string;
}

export const ALGORITHM_VERSION = "v1";
export const DEFAULT_SESSION_SIZE = 8;
export const RECENT_RECOMMENDATION_COOLDOWN_DAYS = 14;
