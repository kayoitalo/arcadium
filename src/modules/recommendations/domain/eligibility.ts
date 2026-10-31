import type { RawCandidate } from "./recommendation.types";
import type { UserProfile } from "./taste-profile";
import { trackFeedbackKey } from "./feedback";

export function eligibleCandidates(candidates: RawCandidate[], profile: UserProfile, recentKeys: Set<string>): RawCandidate[] {
  return candidates.filter((candidate) => {
    const key = candidate.artistName.toLowerCase() + "|" + candidate.trackName.toLowerCase();
    const history = candidate.evidence?.find((evidence) => evidence.kind === "history_revisit");
    const justifiedRevisit = candidate.isRevisit && history?.lastPlayedAt && (history.playCount ?? 0) >= 3
      && new Date(history.lastPlayedAt).getTime() < new Date(profile.referenceTime ?? Date.now()).getTime() - 90 * 86_400_000;
    if (profile.knownTrackKeys.has(key) && !justifiedRevisit) return false;
    if (recentKeys.has(key)) return false;
    return profile.feedbackMap.get(trackFeedbackKey(candidate.artistName, candidate.trackName)) !== "DISLIKED";
  });
}
