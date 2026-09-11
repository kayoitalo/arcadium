import { describe, expect, it } from "vitest";
import { mergeArtistGenres } from "./artist-genres";
import { decadeDistribution } from "./decades";

describe("mergeArtistGenres", () => {
  it("keeps curated tags when the artist has them", () => {
    expect(mergeArtistGenres("punk rock, Seen Live, pop punk", ["rock"])).toEqual(["punk rock", "pop punk"]);
  });

  it("falls back to the most common catalog genre of the artist's albums", () => {
    expect(mergeArtistGenres(null, ["hip hop", "pop", "hip hop", null])).toEqual(["hip hop"]);
  });

  it("returns nothing when neither source knows the artist", () => {
    expect(mergeArtistGenres("Japan, seen live", [])).toEqual([]);
  });
});

describe("decadeDistribution", () => {
  it("splits plays with a known year by decade and reports the coverage apart", () => {
    const result = decadeDistribution([1977, 1979, 1994, 2003, 2003, null, undefined, 1850]);

    expect(result.items).toEqual([
      { decade: 1970, plays: 2, share: 40 },
      { decade: 1990, plays: 1, share: 20 },
      { decade: 2000, plays: 2, share: 40 },
    ]);
    expect(result.coverage).toBe(63);
  });

  it("handles an empty period", () => {
    expect(decadeDistribution([])).toEqual({ items: [], coverage: 0 });
  });
});
