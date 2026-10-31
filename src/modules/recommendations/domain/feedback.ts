import type { FeedbackType } from "./recommendation.types";

export const FEEDBACK_TYPES = ["LIKED", "DISLIKED", "ALREADY_KNOW", "NOT_INTERESTED", "SAVE_FOR_LATER",
  "SKIPPED", "REQUEST_MISMATCH", "CURIOUS", "NOT_LISTENED", "RETRACTED"] as const;
export const ASPECTS = ["VOCALS", "INSTRUMENTAL", "LYRICS", "RHYTHM", "ATMOSPHERE", "OTHER"] as const;
export type FeedbackChannel = "preference" | "familiarity" | "collection" | "request" | "curiosity" | "listening" | "legacy";
export interface FeedbackEntry {
  id: string; type: string; channel?: string | null; revision?: number | null;
  createdAt: Date | string; note?: string | null; details?: unknown;
}

export function feedbackChannel(type: string): FeedbackChannel {
  if (type === "LIKED" || type === "DISLIKED") return "preference";
  if (type === "ALREADY_KNOW") return "familiarity";
  if (type === "SAVE_FOR_LATER") return "collection";
  if (type === "REQUEST_MISMATCH") return "request";
  if (type === "CURIOUS") return "curiosity";
  if (type === "SKIPPED" || type === "NOT_LISTENED") return "listening";
  return "legacy"; // NOT_INTERESTED never becomes a specific negative preference.
}

export function effectiveFeedback<T extends FeedbackEntry>(entries: T[]): Partial<Record<FeedbackChannel, T>> {
  const states: Partial<Record<FeedbackChannel, T>> = {};
  const ordered = [...entries].sort((a, b) => {
    if (a.revision != null || b.revision != null) return (a.revision ?? 0) - (b.revision ?? 0);
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || a.id.localeCompare(b.id);
  });
  for (const entry of ordered) states[(entry.channel as FeedbackChannel) || feedbackChannel(entry.type)] = entry;
  return states;
}

export const feedbackStatus: Record<FeedbackType, string> = {
  LIKED: "LIKED", DISLIKED: "DISLIKED", ALREADY_KNOW: "KNOWN", SAVE_FOR_LATER: "SAVED",
  NOT_INTERESTED: "NOT_INTERESTED", SKIPPED: "SKIPPED", REQUEST_MISMATCH: "REQUEST_MISMATCH",
  CURIOUS: "CURIOUS", NOT_LISTENED: "NOT_LISTENED", RETRACTED: "PENDING",
};

export function trackFeedbackKey(artistName: string, trackName: string): string {
  return JSON.stringify([artistName.toLowerCase(), trackName.toLowerCase()]);
}

export function effectiveTrackFeedback<T extends FeedbackEntry & { itemId: string; item: { artistName: string; trackName: string } }>(entries: T[]) {
  const byItem = new Map<string, T[]>();
  for (const entry of entries) byItem.set(entry.itemId, [...(byItem.get(entry.itemId) ?? []), entry]);
  const byTrack = new Map<string, Partial<Record<FeedbackChannel, T>>>();
  for (const rows of byItem.values()) {
    const key = trackFeedbackKey(rows[0].item.artistName, rows[0].item.trackName);
    const current = byTrack.get(key) ?? {};
    for (const [channel, entry] of Object.entries(effectiveFeedback(rows))) {
      const previous = current[channel as FeedbackChannel];
      if (entry && (!previous || new Date(entry.createdAt).getTime() > new Date(previous.createdAt).getTime()
        || (new Date(entry.createdAt).getTime() === new Date(previous.createdAt).getTime() && entry.id > previous.id))) current[channel as FeedbackChannel] = entry;
    }
    byTrack.set(key, current);
  }
  return byTrack;
}

export class DiscoveryConflict extends Error {
  constructor(message: string, public status = 409, public code = "DISCOVERY_CONFLICT") { super(message); }
}
