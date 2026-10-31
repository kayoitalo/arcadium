

export type RecommendationMode = "SAFE" | "BALANCED" | "EXPERIMENTAL";
export type RecommendationContext = "GENERAL" | "WORKING" | "STUDYING" | "EXERCISING" | "RELAXING";

export type FeedbackType = "LIKED" | "DISLIKED" | "ALREADY_KNOW" | "NOT_INTERESTED" | "SAVE_FOR_LATER"
  | "SKIPPED" | "REQUEST_MISMATCH" | "CURIOUS" | "NOT_LISTENED" | "RETRACTED";
export type SessionOperation = "AUTO" | "RESUME" | "MORE" | "NEW_ENTRY";

export interface ScoreComponents {
  artistSimilarity: number;
  genreSimilarity: number;
  profileRelevance: number;
  noveltyFit: number;
  feedbackFit: number;
  metadataConfidence: number;
  /** O quanto a distância da sugestão bate com a que a pessoa pediu. */
  proximityFit: number;
  /** O quanto o tamanho da plateia bate com o que a pessoa pediu. */
  fameFit: number;
}

/**
 * Os dois controles que a pessoa mexe. Não são filtros — são alvos: o
 * motor procura o que cai perto do ponto escolhido, não o que passa de
 * um corte. Por isso "obscuro" não devolve só lixo desconhecido, e
 * "perto" não devolve só quem ela já conhece.
 */
export interface DiscoveryDials {
  /** 0 = longe do gosto atual, 100 = colado nele. */
  proximity: number;
  /** 0 = ninguém ouve, 100 = todo mundo ouve. */
  fame: number;
}

export const MODE_DIALS: Record<RecommendationMode, DiscoveryDials> = {
  SAFE: { proximity: 85, fame: 70 },
  BALANCED: { proximity: 55, fame: 50 },
  EXPERIMENTAL: { proximity: 25, fame: 25 },
};

export const MODE_WEIGHTS: Record<RecommendationMode, ScoreComponents> = {
  SAFE: {
    artistSimilarity: 0.22,
    genreSimilarity: 0.16,
    profileRelevance: 0.14,
    noveltyFit: 0.04,
    feedbackFit: 0.10,
    metadataConfidence: 0.04,
    proximityFit: 0.20,
    fameFit: 0.10,
  },
  BALANCED: {
    artistSimilarity: 0.18,
    genreSimilarity: 0.15,
    profileRelevance: 0.12,
    noveltyFit: 0.10,
    feedbackFit: 0.10,
    metadataConfidence: 0.05,
    proximityFit: 0.18,
    fameFit: 0.12,
  },
  EXPERIMENTAL: {
    artistSimilarity: 0.08,
    genreSimilarity: 0.10,
    profileRelevance: 0.10,
    noveltyFit: 0.22,
    feedbackFit: 0.12,
    metadataConfidence: 0.05,
    proximityFit: 0.18,
    fameFit: 0.15,
  },
};

export interface RawCandidate {
  artistName: string;
  trackName: string;
  albumName?: string;
  genre?: string;
  source: "similar_artist" | "similar_track" | "genre_adjacency" | "artist_graph" | "top_artist_deep_cut" | "history_revisit";
  sourceArtistName?: string;
  artistId?: string;
  trackId?: string;
  /** Afinidade com a semente, 0..1, como o provedor externo mediu. */
  match?: number;
  /** Ouvintes únicos do artista, para posicionar na escala de fama. */
  listeners?: number;
  evidence?: RecommendationEvidence[];
  isRevisit?: boolean;
  providerRank?: number;
}

export interface RecommendationEvidence {
  kind: "artist_similarity" | "track_similarity" | "artist_catalog" | "genre_overlap" | "history_revisit";
  source: "lastfm" | "catalog" | "history";
  seedArtist?: string;
  seedTrack?: string;
  region?: "long_term" | "recent" | "feedback";
  rank?: number;
  rawMatch?: number;
  genre?: string;
  lastPlayedAt?: string;
  playCount?: number;
}

export interface ScoredCandidate extends RawCandidate {
  score: number;
  noveltyScore: number;
  components: ScoreComponents;
  reason: string;
  /** Coordenadas 0..100 da sugestão nos mesmos eixos dos controles. */
  position: DiscoveryDials | null;
}

export const ALGORITHM_VERSION = "v3-hybrid-2";
export const DEFAULT_SESSION_SIZE = 8;
export const RECENT_RECOMMENDATION_COOLDOWN_DAYS = 14;
