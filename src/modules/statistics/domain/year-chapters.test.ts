import { describe, expect, it } from "vitest";
import { yearChapters, type YearFacts } from "./year-chapters";

const facts: YearFacts = {
  year: 2026, ongoing: false, throughMonth: 12, plays: 18432, artists: 640,
  topArtist: { name: "Milton Nascimento", plays: 412 },
  newcomer: { name: "Chico Science & Nação Zumbi", plays: 188, firstMonth: 10 },
  topAlbum: { name: "Clube da Esquina", artist: "Milton Nascimento & Lô Borges", plays: 212, months: 12, coverUrl: null },
  peakHour: { hour: 21, plays: 2100 },
  fullestMonth: { month: 3, plays: 2400 },
};

describe("teu ano, em capítulos", () => {
  it("tells nothing about a year without plays", () => {
    expect(yearChapters({ ...facts, plays: 0 })).toEqual([]);
  });

  it("tells each chapter with the number that backs it, and marks a piece the sentence really contains", () => {
    const chapters = yearChapters(facts);
    expect(chapters.map((chapter) => chapter.id)).toEqual(["frase", "chegou", "hora", "mes", "disco"]);
    for (const chapter of chapters) expect(chapter.headline.toLowerCase()).toContain(chapter.mark.toLowerCase());
    expect(chapters[0].headline).toContain("18.432");
    expect(chapters[1].headline).toContain("outubro");
    expect(chapters[2].headline).toContain("21h");
    expect(chapters[3].headline).toMatch(/^Março/);
    expect(chapters[4].narrative).toContain("todos os meses");
    expect(chapters[4].proof).toMatchObject({ kind: "cover", tally: 12 });
  });

  it("says 'até aqui' while the year is still running and skips what has no proof", () => {
    const chapters = yearChapters({ ...facts, ongoing: true, throughMonth: 11, newcomer: null, topAlbum: null, fullestMonth: null });
    expect(yearChapters({ ...facts, ongoing: true, throughMonth: 11, topAlbum: { ...facts.topAlbum!, months: 11 } }).at(-1)!.narrative).toContain("todos os meses");
    expect(chapters[0].headline).toMatch(/^2026, até aqui/);
    expect(chapters.map((chapter) => chapter.id)).toEqual(["frase", "hora"]);
  });

  it("does not present the year's top artist as a newcomer twice", () => {
    expect(yearChapters({ ...facts, newcomer: { name: "Milton Nascimento", plays: 412, firstMonth: 1 } }).some((chapter) => chapter.id === "chegou")).toBe(false);
  });

  it("counts months for an album that did not appear all year", () => {
    const disco = yearChapters({ ...facts, topAlbum: { ...facts.topAlbum!, months: 1 } }).find((chapter) => chapter.id === "disco")!;
    expect(disco.narrative).toContain("1 mês");
  });
});
