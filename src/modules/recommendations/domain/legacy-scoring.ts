

import { genreLabel } from "@/lib/format/genre";
import { trackFeedbackKey } from "./feedback";
import {
  type DiscoveryDials,
  MODE_DIALS,
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
  /** Explicit preference by complete artist/track text; never an artist-wide vote. */
  feedbackMap: Map<string, FeedbackType>;
  totalPlays: number;
  uniqueArtists: number;
}

/**
 * Ouvintes viram escala 0..1 em log, não linear: a diferença entre 60 mil
 * e 600 mil ouvintes importa tanto quanto entre 600 mil e 6 milhões. Numa
 * escala linear todo mundo abaixo de um milhão viraria "zero".
 */
export function fameOf(listeners?: number): number {
  if (!listeners || listeners <= 0) return 0.35;
  const scaled = (Math.log10(listeners) - 3) / 4; // 1 mil -> 0, 10 milhões -> 1
  return Math.min(1, Math.max(0, scaled));
}

/** Distância do gosto atual: é a própria afinidade medida pelo provedor. */
export function proximityOf(candidate: RawCandidate): number {
  if (typeof candidate.match === "number") return Math.min(1, Math.max(0, candidate.match));
  if (candidate.source === "top_artist_deep_cut") return 0.95;
  if (candidate.source === "artist_graph") return 0.6;
  return 0.5;
}

/** Quanto mais perto do alvo pedido, melhor. Alvo, não corte. */
function fitTo(target: number, actual: number): number {
  return 1 - Math.abs(target - actual);
}

export function computeComponents(
  candidate: RawCandidate,
  profile: UserProfile,
  dials: DiscoveryDials = MODE_DIALS.BALANCED
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
    proximityFit: fitTo(dials.proximity / 100, proximityOf(candidate)),
    fameFit: fitTo(dials.fame / 100, fameOf(candidate.listeners)),
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
    components.metadataConfidence * weights.metadataConfidence +
    components.proximityFit * weights.proximityFit +
    components.fameFit * weights.fameFit;

  return Math.round(Math.min(100, Math.max(0, raw * 100)));
}

export function scoreAndRank(
  candidates: RawCandidate[],
  profile: UserProfile,
  mode: RecommendationMode,
  dials: DiscoveryDials = MODE_DIALS[mode]
): ScoredCandidate[] {
  const scored = candidates.map((candidate) => {
    const components = computeComponents(candidate, profile, dials);
    const score = calculateScore(components, mode);
    const noveltyScore = Math.round(components.noveltyFit * 100);
    const position = {
      proximity: Math.round(proximityOf(candidate) * 100),
      fame: Math.round(fameOf(candidate.listeners) * 100),
    };
    const reason = buildReason(candidate, position, score, mode);

    return {
      ...candidate,
      score,
      noveltyScore,
      components,
      reason,
      position: candidate.listeners !== undefined && candidate.listeners > 0 ? position : null,
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

  const trackFeedback = profile.feedbackMap.get(trackFeedbackKey(candidate.artistName, candidate.trackName));

  if (trackFeedback === "LIKED") return 0.9;
  if (trackFeedback === "DISLIKED") return 0.0;

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

/**
 * Por que ele sugere esta: dito por ele, como amigo que indica música —
 * de onde veio a ideia, onde ela fica no mapa que você pediu e quanto ele
 * aposta nela.
 */
function buildReason(
  candidate: RawCandidate,
  position: { proximity: number; fame: number },
  score: number,
  mode: RecommendationMode
): string {
  const origin =
    candidate.source === "similar_artist" && candidate.sourceArtistName
      ? `O Last.fm relaciona este artista com ${candidate.sourceArtistName}.`
      : candidate.source === "top_artist_deep_cut" && candidate.sourceArtistName
        ? `É de ${candidate.sourceArtistName}, e não apareceu no histórico importado.`
        : candidate.source === "artist_graph"
          ? "Cruza dois gêneros que você mais ouve."
          : candidate.genre
            ? `Mora perto de ${genreLabel(candidate.genre)}, que você ouve.`
            : "Fica perto do que você já ouve.";

  // as duas coordenadas viram frase: é o que a pessoa acabou de pedir no mapa
  const distancia =
    position.proximity >= 70 ? 'Bem no teu território'
    : position.proximity >= 40 ? 'Um passo pro lado'
    : 'Longe da tua zona';

  const plateia =
    !(candidate.listeners !== undefined && candidate.listeners > 0) ? 'sem dados suficientes de público'
    : position.fame >= 70 ? 'e muita gente já ouviu'
    : position.fame >= 40 ? 'de público médio'
    : 'e quase ninguém conhece';

  return `${origin} ${distancia}, ${plateia}.`;
}
