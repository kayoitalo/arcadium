import { describe, expect, it } from "vitest";
import { isCollaborationOfKnownArtist, limitPerArtist } from "./candidate-filters";

const known = new Set(["michael jackson", "ramones", "bad bunny"]);

describe("isCollaborationOfKnownArtist", () => {
  it("reconhece o próprio artista conhecido", () => {
    expect(isCollaborationOfKnownArtist("Michael Jackson", known)).toBe(true);
    expect(isCollaborationOfKnownArtist("  ramones  ", known)).toBe(true);
  });

  it("barra colaborações que apenas acrescentam um convidado", () => {
    expect(isCollaborationOfKnownArtist("Michael Jackson & Justin Timberlake", known)).toBe(true);
    expect(isCollaborationOfKnownArtist("Bad Bunny feat. Drake", known)).toBe(true);
    expect(isCollaborationOfKnownArtist("Cardi B, Bad Bunny", known)).toBe(true);
    expect(isCollaborationOfKnownArtist("Ramones vs. The Clash", known)).toBe(true);
  });

  it("deixa passar artista realmente novo", () => {
    expect(isCollaborationOfKnownArtist("Joey Ramone", known)).toBe(false);
    expect(isCollaborationOfKnownArtist("Justin Timberlake", known)).toBe(false);
    expect(isCollaborationOfKnownArtist("The Clash & Mick Jones", known)).toBe(false);
  });
});

describe("limitPerArtist", () => {
  const candidates = [
    { artistName: "Myke Towers", trackName: "LALA" },
    { artistName: "Myke Towers", trackName: "ADIVINO" },
    { artistName: "JHAYCO", trackName: "No Me Conoce" },
    { artistName: "myke towers", trackName: "Girl" },
  ];

  it("mantém apenas a primeira faixa de cada artista", () => {
    expect(limitPerArtist(candidates, 1).map((item) => item.trackName)).toEqual(["LALA", "No Me Conoce"]);
  });

  it("respeita o teto informado e ignora diferença de caixa", () => {
    expect(limitPerArtist(candidates, 2).map((item) => item.trackName)).toEqual([
      "LALA",
      "ADIVINO",
      "No Me Conoce",
    ]);
  });

  it("preserva a ordem de entrada", () => {
    const ordered = limitPerArtist(candidates, 5);
    expect(ordered).toHaveLength(4);
    expect(ordered[0].trackName).toBe("LALA");
  });
});
