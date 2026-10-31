import { PROFILE_WEIGHTS, type UserProfile } from "./taste-profile";
import type { DiscoveryDials, RawCandidate, RecommendationEvidence, RecommendationMode, ScoredCandidate, ScoreComponents } from "./recommendation.types";
import { MODE_DIALS } from "./recommendation.types";
import { trackFeedbackKey } from "./feedback";
export type { UserProfile } from "./taste-profile";
export { fameOf } from "./legacy-scoring";
import { fameOf } from "./legacy-scoring";

export const HYBRID_WEIGHTS: ScoreComponents = { artistSimilarity: .12, genreSimilarity: .16, profileRelevance: .17,
  noveltyFit: .10, feedbackFit: .20, metadataConfidence: .05, proximityFit: .15, fameFit: .05 };
export const RANKING_VERSION = "hybrid-weights-1";

function relations(candidate: RawCandidate, profile: UserProfile) {
  return (candidate.evidence ?? []).filter((evidence) => {
    if (!evidence.seedArtist || !evidence.seedTrack) return true;
    return profile.feedbackMap.get(trackFeedbackKey(evidence.seedArtist, evidence.seedTrack)) !== "DISLIKED";
  });
}
function relationStrength(evidence: RecommendationEvidence): number {
  return evidence.kind === "track_similarity" || evidence.kind === "artist_similarity"
    ? 1 / (1 + Math.max(0, (evidence.rank ?? 1) - 1) * .15) : 0;
}
export function proximityOf(candidate: RawCandidate): number {
  if (candidate.source === "top_artist_deep_cut" || candidate.isRevisit) return .9;
  const strengths = (candidate.evidence ?? []).map(relationStrength);
  return strengths.length ? Math.max(.3, ...strengths) : typeof candidate.match === "number" ? Math.min(1, Math.max(0, candidate.match)) : .5;
}
function genreFit(candidate: RawCandidate, profile: UserProfile): number {
  const tags = (candidate.genre ?? "").toLowerCase().split(/\s*[/,]\s*/).filter(Boolean);
  if (!tags.length) return .5;
  if (!profile.longTerm || !profile.recent) return tags.some((tag) => profile.topGenres.includes(tag)) ? .8 : .3;
  const affinity = (slice: NonNullable<UserProfile["longTerm"]>) => tags.reduce((sum, tag) => sum + (slice.genres.find((genre) => genre.name === tag)?.share ?? 0), 0);
  const longWeight = profile.longTerm.genres.length ? PROFILE_WEIGHTS.longTerm : 0;
  const recentWeight = profile.recent.genres.length ? PROFILE_WEIGHTS.recent : 0;
  if (!(longWeight + recentWeight)) return .5;
  const observed = Math.min(1, .25 + .75 * (longWeight * affinity(profile.longTerm) + recentWeight * affinity(profile.recent)) / (longWeight + recentWeight));
  const coverage = (longWeight * profile.longTerm.genreCoverage + recentWeight * profile.recent.genreCoverage) / (longWeight + recentWeight);
  return .5 + (observed - .5) * coverage;
}
export function computeComponents(candidate: RawCandidate, profile: UserProfile, dials: DiscoveryDials = MODE_DIALS.BALANCED): ScoreComponents {
  const evidence = relations(candidate, profile);
  const related = evidence.map(relationStrength);
  const direct = profile.feedbackMap.get(trackFeedbackKey(candidate.artistName, candidate.trackName));
  const likedLink = evidence.some((entry) => entry.seedArtist && entry.seedTrack
    && profile.feedbackMap.get(trackFeedbackKey(entry.seedArtist, entry.seedTrack)) === "LIKED");
  const known = profile.knownTrackKeys.has(candidate.artistName.toLowerCase() + "|" + candidate.trackName.toLowerCase());
  const hasReach = candidate.listeners !== undefined && candidate.listeners > 0;
  return {
    artistSimilarity: Math.max(.3, ...related),
    genreSimilarity: genreFit(candidate, profile),
    profileRelevance: evidence.some((entry) => entry.region === "feedback") ? .9
      : new Set(evidence.map((entry) => entry.region).filter(Boolean)).size > 1 ? .85
      : evidence.some((entry) => entry.region === "recent") ? .75 : evidence.length ? .65 : .4,
    noveltyFit: known ? .05 : profile.knownArtistNames.has(candidate.artistName.toLowerCase()) ? .65 : .9,
    feedbackFit: direct === "DISLIKED" ? 0 : direct === "LIKED" ? .95 : likedLink ? .85 : .5,
    metadataConfidence: candidate.trackId ? .8 : evidence.some((entry) => entry.kind === "track_similarity") ? .7 : .5,
    proximityFit: 1 - Math.abs(dials.proximity / 100 - proximityOf({ ...candidate, evidence })),
    fameFit: hasReach ? 1 - Math.abs(dials.fame / 100 - fameOf(candidate.listeners)) : .5,
  };
}
export function calculateScore(components: ScoreComponents, _mode: RecommendationMode): number {
  return Math.round(100 * Object.entries(HYBRID_WEIGHTS).reduce((sum, [key, weight]) => sum + weight * components[key as keyof ScoreComponents], 0));
}
export function buildEvidenceReason(candidate: RawCandidate, profile: UserProfile): string {
  const evidence = relations(candidate, profile);
  if (candidate.isRevisit) {
    const last = evidence.find((entry) => entry.kind === "history_revisit")?.lastPlayedAt;
    return "Revisita: esta faixa apareceu mais de uma vez no teu histórico" + (last ? "; a última reprodução registrada foi em " + last.slice(0, 10) : "") + ".";
  }
  const track = evidence.find((entry) => entry.kind === "track_similarity");
  const artist = evidence.find((entry) => entry.kind === "artist_similarity");
  const catalog = evidence.find((entry) => entry.kind === "artist_catalog");
  const genre = evidence.find((entry) => entry.kind === "genre_overlap");
  let reason = track ? 'O Last.fm relaciona esta faixa com “' + track.seedTrack + '”, de ' + track.seedArtist + '.'
    : artist ? 'O Last.fm relaciona este artista com ' + artist.seedArtist + '.'
    : catalog ? 'Uma faixa do catálogo de ' + catalog.seedArtist + ', artista do teu repertório importado.'
    : genre ? 'O catálogo associa este artista a ' + genre.genre + ', presente no teu histórico.'
    : profile.knownArtistNames.has(candidate.artistName.toLowerCase()) ? 'Uma faixa de um artista presente no teu repertório importado.' : 'Uma sugestão com metadados limitados; vale conferir antes de decidir.';
  if (track?.seedArtist && track.seedTrack && profile.feedbackMap.get(trackFeedbackKey(track.seedArtist, track.seedTrack)) === "LIKED") reason += ' Você marcou essa referência como “curti”.';
  if (track?.region === "recent" || artist?.region === "recent") reason += ' A referência vem da tua fase recente.';
  if (!profile.knownTrackKeys.has(candidate.artistName.toLowerCase() + "|" + candidate.trackName.toLowerCase())) reason += ' Não apareceu no histórico importado.';
  return reason;
}
export function scoreAndRank(candidates: RawCandidate[], profile: UserProfile, mode: RecommendationMode, dials: DiscoveryDials = MODE_DIALS[mode]): ScoredCandidate[] {
  return candidates.map((candidate) => {
    const components = computeComponents(candidate, profile, dials);
    return { ...candidate, components, score: calculateScore(components, mode), noveltyScore: Math.round(components.noveltyFit * 100),
      reason: buildEvidenceReason(candidate, profile), position: candidate.listeners !== undefined && candidate.listeners > 0
        ? { proximity: Math.round(proximityOf(candidate) * 100), fame: Math.round(fameOf(candidate.listeners) * 100) } : null };
  }).sort((a, b) => b.score - a.score || (a.providerRank ?? 99) - (b.providerRank ?? 99)
    || trackFeedbackKey(a.artistName, a.trackName).localeCompare(trackFeedbackKey(b.artistName, b.trackName)));
}
