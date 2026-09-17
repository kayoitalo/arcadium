import { describe, expect, it } from "vitest";
import type { MusicProfileInput } from "../domain/ai-analysis.types";
import { cleanWikiSummary, factSubjects } from "./lastfm-facts-adapter";

describe("cleanWikiSummary", () => {
  it("drops the Last.fm link and HTML", () => {
    expect(
      cleanWikiSummary(
        'Imagine Dragons é uma banda de pop rock formada em Las Vegas. <a href="https://www.last.fm/music/Imagine+Dragons">Leia mais no Last.fm</a>',
      ),
    ).toBe("Imagine Dragons é uma banda de pop rock formada em Las Vegas.");
  });

  it("cuts long summaries at the end of a sentence", () => {
    const long = `${"Frase longa sobre a banda que continua. ".repeat(20)}`;
    const cleaned = cleanWikiSummary(long)!;
    expect(cleaned.length).toBeLessThanOrEqual(420);
    expect(cleaned.endsWith(".")).toBe(true);
  });

  it("ignores empty or too-short summaries", () => {
    expect(cleanWikiSummary("")).toBeNull();
    expect(cleanWikiSummary('<a href="x">Read more on Last.fm</a>')).toBeNull();
  });
});

describe("factSubjects", () => {
  const profile = {
    topArtists: [{ name: "Daft Punk", plays: 35, share: 0.03 }],
    mostPlayed: {
      track: { name: "Body", artist: "Don Toliver", plays: 8 },
      album: { name: "DeBÍ TiRAR MáS FOToS", artist: "Bad Bunny", plays: 22 },
    },
    outliers: [{ name: "Chico Science & Nação Zumbi", plays: 9, genre: "mangue beat" }],
    comebacks: [{ name: "Imagine Dragons", plays: 32, awayFor: "mais de 3 anos" }],
  } as unknown as MusicProfileInput;

  it("asks about the subjects the angles talk about, at most four", () => {
    expect(factSubjects(profile)).toEqual([
      { kind: "disco", artist: "Bad Bunny", album: "DeBÍ TiRAR MáS FOToS" },
      { kind: "artista", artist: "Daft Punk" },
      { kind: "artista", artist: "Chico Science & Nação Zumbi" },
      { kind: "artista", artist: "Imagine Dragons" },
    ]);
  });

  it("does not ask twice about the same artist", () => {
    const sameTop = { ...profile, outliers: [], comebacks: [{ name: "Daft Punk", plays: 35, awayFor: "9 meses" }] };
    expect(factSubjects(sameTop).filter((subject) => subject.artist === "Daft Punk")).toHaveLength(1);
  });
});
