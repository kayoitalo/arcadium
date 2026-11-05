import { describe, it, expect } from "vitest";
import { buildListeningCues } from "./listening-cues";
const item = () => ({ artistName: "Synthetic", trackName: "Song (Live)", appleMusicUrl: "https://music.apple.com/br/album/example/42?i=43",
  scoreComponents: { previewIdentity: { source: "itunes", sourceId: "43", artistName: "Synthetic", trackName: "Song (Live)", match: "compatible-text-v1" },
    catalogFacts: { durationMs: 185000, fetchedAt: "2026-11-04T00:00:00Z" } } });
describe("recording-scoped factual listening invitations", () => {
  it("reuses catalog facts without AI, audio analysis or sonic claims", () => {
    const result = buildListeningCues(item());
    expect(result.status).toBe("AVAILABLE"); expect(result.cues.map((cue) => cue.kind)).toEqual(["DURATION", "VERSION_LABEL"]);
    expect(result.cues[0].fact).toContain("3:05"); expect(result.cues.every((cue) => cue.source.sourceId === "43" && cue.source.scope === "catalog-track")).toBe(true);
    expect(buildListeningCues(item())).toEqual(result);
  });
  it("never turns artist/album wiki or mismatched media into a recording-level cue", () => {
    for (const changed of [
      { ...item(), trackName: "Song (Remix)" }, { ...item(), appleMusicUrl: "https://evil.test/43" },
      { ...item(), appleMusicUrl: "https://music.apple.com/br/album/example/42?i=999" },
      { ...item(), scoreComponents: { culturalContext: { kind: "album", text: "Invented instrument" } } },
      { ...item(), scoreComponents: { ...item().scoreComponents, catalogFacts: { durationMs: -2, fetchedAt: "bad" } } },
    ]) expect(buildListeningCues(changed).status).toBe("INSUFFICIENT_EVIDENCE");
  });
});
