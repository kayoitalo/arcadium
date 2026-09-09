

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
  /** Afinidade com a semente, 0..1, como o provedor externo mediu. */
  match?: number;
  /** Ouvintes únicos do artista, para posicionar na escala de fama. */
  listeners?: number;
}

export interface ScoredCandidate extends RawCandidate {
  score: number;
  noveltyScore: number;
  components: ScoreComponents;
  reason: string;
  /** Coordenadas 0..100 da sugestão nos mesmos eixos dos controles. */
  position: DiscoveryDials;
}

export const ALGORITHM_VERSION = "v2-dials";
export const DEFAULT_SESSION_SIZE = 8;
export const RECENT_RECOMMENDATION_COOLDOWN_DAYS = 14;
