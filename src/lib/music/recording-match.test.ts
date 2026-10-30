import { describe, expect, it } from "vitest";
import { compatibleRecording, sameRecordingText } from "./recording-match";

describe("recording compatibility", () => {
  it.each(["Live", "Acoustic", "2004 Remaster", "Radio Edit", "Clean", "Remix", "feat. Guest"])(
    "preserves the %s qualifier", (qualifier) => {
      expect(sameRecordingText("Dreams", `Dreams (${qualifier})`)).toBe(false);
    },
  );
  it("preserves title words in parentheses and non-Latin writing", () => {
    expect(sameRecordingText("Don't You (Forget About Me)", "Don't You")).toBe(false);
    expect(sameRecordingText("東京", "大阪")).toBe(false);
    expect(sameRecordingText("", "!")).toBe(false);
  });
  it("accepts case and punctuation differences of the same full title", () => {
    expect(sameRecordingText("Numb (Live)", "NUMB - Live")).toBe(true);
  });
  it("rejects tribute performers and similar artist names", () => {
    expect(compatibleRecording({ artistName: "Queen", trackName: "Dreams" }, {
      artistName: "Queen Tribute", trackName: "Dreams",
    })).toBe(false);
  });
});
