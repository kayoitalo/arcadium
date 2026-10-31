import { describe, expect, it } from "vitest";
import { effectiveFeedback, effectiveTrackFeedback, feedbackChannel, trackFeedbackKey } from "./feedback";
import { feedbackRequest, progressRequest, sessionRequest } from "./contracts";
const entry = (id: string, type: string, revision?: number) => ({ id, type, revision, createdAt: "2026-10-30T12:00:00Z" });
describe("feedback interpretation", () => {
  it("never converts legacy disinterest into a specific taste/mood rejection", () => {
    expect(feedbackChannel("NOT_INTERESTED")).toBe("legacy");
    expect(effectiveFeedback([entry("old", "NOT_INTERESTED")]).preference).toBeUndefined();
  });
  it("uses the latest revision even when timestamps match and input order differs", () => {
    const states = effectiveFeedback([entry("a", "LIKED", 3), entry("z", "DISLIKED", 2), entry("old", "DISLIKED")]);
    expect(states.preference?.type).toBe("LIKED");
  });
  it("keeps scope, familiarity, listening and curiosity independent of preference", () => {
    const states = effectiveFeedback([entry("a", "LIKED", 1), entry("b", "REQUEST_MISMATCH", 2),
      entry("c", "ALREADY_KNOW", 3), entry("d", "NOT_LISTENED", 4), entry("e", "CURIOUS", 5)]);
    expect(states.preference?.type).toBe("LIKED"); expect(states.request?.type).toBe("REQUEST_MISMATCH");
    expect(states.familiarity?.type).toBe("ALREADY_KNOW"); expect(states.listening?.type).toBe("NOT_LISTENED");
    expect(states.curiosity?.type).toBe("CURIOUS");
  });
  it("does not revive an old taste assessment when another channel is touched later", () => {
    const item = { artistName: "Band", trackName: "Song" };
    const rows = [
      { ...entry("one", "LIKED", 1), createdAt: "2026-10-01", itemId: "old", item },
      { ...entry("two", "DISLIKED", 1), createdAt: "2026-10-10", itemId: "new", item },
      { ...entry("three", "CURIOUS", 2), createdAt: "2026-10-20", itemId: "old", item },
    ];
    expect(effectiveTrackFeedback(rows).get(trackFeedbackKey("Band", "Song"))?.preference?.type).toBe("DISLIKED");
  });
});
describe("discovery contracts", () => {
  it("keeps legacy requests compatible and requires a new-search operation key", () => {
    expect(sessionRequest.parse({ mode: "BALANCED" }).operation).toBe("AUTO");
    expect(sessionRequest.safeParse({ operation: "NEW_ENTRY" }).success).toBe(false);
    expect(sessionRequest.safeParse({ operation: "MORE", requestKey: crypto.randomUUID() }).success).toBe(false);
    expect(sessionRequest.safeParse({ proximity: Infinity, fame: 30 }).success).toBe(false);
  });
  it("rejects unknown reactions, non-specific retractions and unbounded notes", () => {
    expect(feedbackRequest.safeParse({ itemId: "i", type: "HATE_GENRE" }).success).toBe(false);
    expect(feedbackRequest.safeParse({ itemId: "i", type: "RETRACTED" }).success).toBe(false);
    expect(feedbackRequest.safeParse({ itemId: "i", type: "LIKED", note: "a".repeat(2001) }).success).toBe(false);
    expect(progressRequest.safeParse({ operation: "MOVE", rank: 0, expectedRank: 1 }).success).toBe(false);
  });
});
