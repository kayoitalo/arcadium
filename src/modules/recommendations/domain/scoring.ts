

import {
  type RawCandidate,
  type ScoredCandidate,
  type ScoreComponents,
  type RecommendationMode,
  type FeedbackType,
  MODE_WEIGHTS,
} from "./recommendation.types";

export interface UserProfile {
  topArtistNames: string[];
  topGenres: string[];
  knownArtistNames: Set<string>;
  knownTrackKeys: Set<string>;
  feedbackMap: Map<string, FeedbackType>;
  totalPlays: number;
  uniqueArtists: number;
}

export function computeComponents(
  candidate: RawCandidate,
  profile: UserProfile
): ScoreComponents {

  const artistSimilarity = computeArtistSimilarity(candidate, profile);

  const genreSimilarity = computeGenreSimilarity(candidate, profile);

  const profileRelevance = computeProfileRelevance(candidate, profile);

  const noveltyFit = computeNoveltyFit(candidate, profile);

  const feedbackFit = computeFeedbackFit(candidate, profile);

  const metadataConfidence = computeMetadataConfidence(candidate);

  return {
    artistSimilarity,
    genreSimilarity,
    profileRelevance,
    noveltyFit,
    feedbackFit,
    metadataConfidence,
  };
}

export function calculateScore(
  components: ScoreComponents,
  mode: RecommendationMode
): number {
  const weights = MODE_WEIGHTS[mode];
  const raw =
    components.artistSimilarity * weights.artistSimilarity +
    components.genreSimilarity * weights.genreSimilarity +
    components.profileRelevance * weights.profileRelevance +
    components.noveltyFit * weights.noveltyFit +
    components.feedbackFit * weights.feedbackFit +
    components.metadataConfidence * weights.metadataConfidence;

  return Math.round(Math.min(100, Math.max(0, raw * 100)));
}

export function scoreAndRank(
  candidates: RawCandidate[],
  profile: UserProfile,
  mode: RecommendationMode
): ScoredCandidate[] {
  const scored = candidates.map((candidate) => {
    const components = computeComponents(candidate, profile);
    const score = calculateScore(components, mode);
    const noveltyScore = Math.round(components.noveltyFit * 100);
    const reason = buildReason(candidate, components, score, mode);

    return {
      ...candidate,
      score,
      noveltyScore,
      components,
      reason,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored;
}

function computeArtistSimilarity(candidate: RawCandidate, profile: UserProfile): number {

  if (candidate.source === "similar_artist" && candidate.sourceArtistName) {
    const seedIdx = profile.topArtistNames.indexOf(candidate.sourceArtistName);
    if (seedIdx >= 0) {

      return Math.max(0.3, 1.0 - seedIdx * 0.08);
    }
    return 0.5;
  }

  if (candidate.source === "artist_graph") {
    return 0.6;
  }

  if (candidate.source === "top_artist_deep_cut") {
    return 0.7;
  }

  return 0.4;
}

function computeGenreSimilarity(candidate: RawCandidate, profile: UserProfile): number {
  if (!candidate.genre) return 0.3;

  const candidateGenres = candidate.genre
    .toLowerCase()
    .split(/[\/,]/)
    .map((g) => g.trim());

  const userGenresLower = profile.topGenres.map((g) => g.toLowerCase());

  let matchCount = 0;
  for (const cg of candidateGenres) {
    for (const ug of userGenresLower) {
      if (cg === ug || cg.includes(ug) || ug.includes(cg)) {
        matchCount++;
        break;
      }
    }
  }

  if (candidateGenres.length === 0) return 0.3;
  return Math.min(1.0, matchCount / candidateGenres.length + 0.2);
}

function computeProfileRelevance(candidate: RawCandidate, profile: UserProfile): number {

  if (candidate.sourceArtistName) {
    const idx = profile.topArtistNames.indexOf(candidate.sourceArtistName);
    if (idx >= 0 && idx < 5) return 0.9;
    if (idx >= 5 && idx < 10) return 0.7;
    if (idx >= 10) return 0.5;
  }
  return 0.4;
}

function computeNoveltyFit(candidate: RawCandidate, profile: UserProfile): number {
  const artistKnown = profile.knownArtistNames.has(candidate.artistName.toLowerCase());
  const trackKey = `${candidate.artistName.toLowerCase()}|${candidate.trackName.toLowerCase()}`;
  const trackKnown = profile.knownTrackKeys.has(trackKey);

  if (trackKnown) return 0.0;
  if (artistKnown) return 0.3;
  return 0.9;
}

function computeFeedbackFit(candidate: RawCandidate, profile: UserProfile): number {

  const artistFeedback = profile.feedbackMap.get(candidate.artistName.toLowerCase());

  if (artistFeedback === "LIKED") return 0.9;
  if (artistFeedback === "SAVE_FOR_LATER") return 0.7;
  if (artistFeedback === "NOT_INTERESTED") return 0.2;
  if (artistFeedback === "DISLIKED") return 0.0;
  if (artistFeedback === "ALREADY_KNOW") return 0.4;

  if (candidate.sourceArtistName) {
    const sourceFeedback = profile.feedbackMap.get(candidate.sourceArtistName.toLowerCase());
    if (sourceFeedback === "LIKED") return 0.7;
    if (sourceFeedback === "DISLIKED") return 0.2;
  }

  return 0.5;
}

function computeMetadataConfidence(candidate: RawCandidate): number {
  let confidence = 0.5;

  if (candidate.genre) confidence += 0.2;
  if (candidate.albumName) confidence += 0.15;
  if (candidate.artistId) confidence += 0.1;
  if (candidate.trackId) confidence += 0.05;

  return Math.min(1.0, confidence);
}

function buildReason(
  candidate: RawCandidate,
  components: ScoreComponents,
  score: number,
  mode: RecommendationMode
): string {
  const parts: string[] = [];
  parts.push(`Match determinístico de ${score}%.`);

  if (candidate.source === "similar_artist" && candidate.sourceArtistName) {
    parts.push(`Artista similar a ${candidate.sourceArtistName}, que está no seu perfil.`);
  } else if (candidate.source === "genre_adjacency") {
    parts.push(`Gênero adjacente aos seus favoritos.`);
  } else if (candidate.source === "artist_graph") {
    parts.push(`Conectado a múltiplos artistas do seu perfil.`);
  } else if (candidate.source === "top_artist_deep_cut") {
    parts.push(`Faixa menos conhecida de um artista que você já ouve.`);
  }

  if (components.noveltyFit > 0.7) {
    parts.push(`Alta novidade — artista novo para você.`);
  }

  if (candidate.genre) {
    parts.push(`Gênero: ${candidate.genre}.`);
  }

  return parts.join(" ");
}
