import { describe, expect, it } from "vitest";
import type { Evidence } from "./conversation.types";
import { countsNewArtists, rankedUnit, unitsAgree } from "./fact-check";

const tracks: Evidence = {
  kind: "ranking", unit: "track", focusIndex: 0, share: 4, citesShare: false, previewUrl: null, previewTrack: "Out of Time",
  cover: { url: null, title: "Dawn FM", artist: "The Weeknd" },
  rows: [{ label: "Out of Time", sub: "The Weeknd", plays: 2 }, { label: "With You", sub: "Chris Brown", plays: 1 }],
};
const albums: Evidence = { ...tracks, unit: "album", rows: [{ label: "Dawn FM", sub: "The Weeknd", plays: 9 }] } as Evidence;

describe("a frase escolhe a prova", () => {
  it("reads what the sentence ranks", () => {
    expect(rankedUnit("O disco 'Dawn FM' acabou sendo o mais rodado das tuas 24 horas.")).toBe("album");
    expect(rankedUnit("A faixa 'Out of Time' foi a mais tocada do dia.")).toBe("track");
    expect(rankedUnit("Tu colocou 'Out of Time' no repeat.")).toBeNull();
    expect(countsNewArtists("Foram 294 artistas novos no teu fone.")).toBe(true);
  });

  it("prefers the proof in the sentence's unit", () => {
    const album = "O disco 'Dawn FM' acabou sendo o mais rodado das tuas 24 horas.";
    expect(unitsAgree(album, tracks)).toBe(false);
    expect(unitsAgree(album, albums)).toBe(true);
    expect(unitsAgree("A faixa 'Out of Time' foi a mais tocada do dia.", tracks)).toBe(true);
    expect(unitsAgree("Foram 294 artistas novos no teu fone.", tracks)).toBe(false);
  });

  it("never judges quoted lyrics: the quotes are not names to find in the proof", () => {
    expect(unitsAgree("Tu repetiu 'I'm running out of time' até virar mantra.", tracks)).toBe(true);
  });
});
