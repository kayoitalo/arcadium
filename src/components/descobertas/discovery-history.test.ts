import { describe, expect, it } from "vitest";
import { groupJourneys, type JourneySession } from "./discovery-history";

const session = (id: string, day: string, root?: string): JourneySession => ({
  sessionId: id, createdAt: day, currentRank: 1, total: 2, intent: null, firstTrack: null,
  journey: root ? { action: "MORE", rootSessionId: root, parentSessionId: root } : null,
});
describe("journey navigation", () => {
  it("groups branches by their root while preserving chronological steps and legacy sessions", () => {
    const result = groupJourneys([session("child", "2026-11-03", "root"), session("legacy", "2026-11-02"), session("root", "2026-11-01", "root")]);
    expect(result.map((group) => group.root)).toEqual(["root", "legacy"]);
    expect(result[0].steps.map((step) => step.sessionId)).toEqual(["root", "child"]);
    expect(result[1].steps[0].intent).toBeNull();
  });
  it("retains a recent fragment even when the root falls outside the bounded history window", () => {
    const result = groupJourneys([session("recent", "2026-11-03", "older-root")]);
    expect(result[0].root).toBe("older-root");
    expect(result[0].steps.map((step) => step.sessionId)).toEqual(["recent"]);
  });
});
