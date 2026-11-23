import { describe, expect, it } from "vitest";
import { compatibleRecording, editionlessTitle, sameRecordingText, sameSongAnyEdition } from "./recording-match";

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

describe("same song in another edition (listening previews)", () => {
  const fleetwood = (trackName: string) => ({ artistName: "Fleetwood Mac", trackName });
  it.each([
    ["Go Your Own Way - 2004 Remaster", "Go Your Own Way"],
    ["Iron Man - 2009 Remaster", "Iron Man (2009 - Remaster)"],
    ["Dreams (Deluxe Edition)", "Dreams"],
    ["God of War (From \"God of War\" Soundtrack)", "God of War"],
    ["Stay (feat. Guest)", "Stay"],
  ])("accepts %s as %s", (expected, found) => {
    expect(sameSongAnyEdition(fleetwood(expected), fleetwood(found))).toBe(true);
  });
  it.each([
    ["Go Your Own Way", "Go Your Own Way (Live)"],
    ["Go Your Own Way - 2004 Remaster", "Go Your Own Way - Live"],
    ["Dreams", "Dreams (Remix)"],
    ["Dreams (Demo)", "Dreams"],
    ["Don't You (Forget About Me)", "Don't You"],
  ])("still tells %s from %s", (expected, found) => {
    expect(sameSongAnyEdition(fleetwood(expected), fleetwood(found))).toBe(false);
  });
  it("never crosses artists and never empties a title", () => {
    expect(sameSongAnyEdition(fleetwood("Dreams"), { artistName: "Fleetwood Mac Tribute", trackName: "Dreams" })).toBe(false);
    expect(editionlessTitle("(Remastered)")).toBe("(Remastered)");
  });
});
