// Frozen from 6a9799cb4fc1a6706a3e1489f11a7f7438a82ee5; edit only when intentionally replacing the evaluation control.
import type { RawCandidate } from "../domain/recommendation.types";
import type { UserProfile } from "../domain/taste-profile";
import { trackFeedbackKey } from "../domain/feedback";

export function eligibleCandidates(candidates: RawCandidate[], profile: UserProfile, recentKeys: Set<string>, allowKnown = false): RawCandidate[] {
  return candidates.filter((candidate) => {
    const key = candidate.artistName.toLowerCase() + "|" + candidate.trackName.toLowerCase();
    const history = candidate.evidence?.find((evidence) => evidence.kind === "history_revisit");
    const justifiedRevisit = candidate.isRevisit && history?.lastPlayedAt && (history.playCount ?? 0) >= 3
      && new Date(history.lastPlayedAt).getTime() < new Date(profile.referenceTime ?? Date.now()).getTime() - 90 * 86_400_000;
    if (profile.knownTrackKeys.has(key) && !justifiedRevisit && !allowKnown) return false;
    if (recentKeys.has(key)) return false;
    return profile.feedbackMap.get(trackFeedbackKey(candidate.artistName, candidate.trackName)) !== "DISLIKED";
  });
}
