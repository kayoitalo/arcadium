import { describe, expect, it } from "vitest";
import { creditNames, coverOf, itunesArtwork, matchFreshReleases, type FeedRelease, type ItunesAlbum } from "./fresh-releases";

const release = (over: Partial<FeedRelease>): FeedRelease => ({
  artist_credit_name: "Ninguém", release_name: "Disco", release_date: "2026-11-10", release_group_primary_type: "Album", ...over,
});

describe("creditNames", () => {
  it("splits composite credits but keeps duos joined by 'e' whole", () => {
    expect(creditNames("Anitta feat. Pedro Sampaio")).toEqual(["anitta feat. pedro sampaio", "anitta", "pedro sampaio"]);
    expect(creditNames("Tyler, The Creator & Kali Uchis")).toContain("kali uchis");
    expect(creditNames("Zezé Di Camargo e Luciano")).toEqual(["zeze di camargo e luciano"]);
  });
});

describe("matchFreshReleases", () => {
  const artists = [
    { name: "The Weeknd", plays: 300, mbid: "c8b03190" },
    { name: "Anitta", plays: 40 },
    { name: "Pedro Sampaio", plays: 90 },
  ];
  it("matches by MBID even when the credit name differs, and by name otherwise", () => {
    const found = matchFreshReleases([
      release({ artist_credit_name: "Abel (The Weeknd)", artist_mbids: ["c8b03190"], release_name: "Novo" }),
      release({ artist_credit_name: "Anitta", release_name: "Funk", release_group_primary_type: "Single" }),
      release({ artist_credit_name: "Alguém Que Não Ouço", release_name: "Nada" }),
    ], artists);
    expect(found.map((entry) => [entry.title, entry.matchedArtist, entry.kind])).toEqual([["Novo", "The Weeknd", "disco"], ["Funk", "Anitta", "single"]]);
  });
  it("skips versions of tracks that already exist", () => {
    expect(matchFreshReleases([release({ artist_credit_name: "Anitta", release_name: "Funk (Solomun Remix)" }), release({ artist_credit_name: "Anitta", release_name: "Funk (sped up)" })], artists)).toEqual([]);
  });
  it("credits a collaboration to whoever the listener plays the most", () => {
    const [found] = matchFreshReleases([release({ artist_credit_name: "Anitta feat. Pedro Sampaio" })], artists);
    expect(found).toMatchObject({ matchedArtist: "Pedro Sampaio", plays: 90 });
  });
  it("keeps one entry per release group and at most two per artist", () => {
    const found = matchFreshReleases([
      release({ artist_credit_name: "Anitta", release_name: "A", release_group_mbid: "g1" }),
      release({ artist_credit_name: "Anitta", release_name: "A (Deluxe)", release_group_mbid: "g1", caa_id: 9, release_mbid: "r" }),
      release({ artist_credit_name: "Anitta", release_name: "B", release_group_mbid: "g2" }),
      release({ artist_credit_name: "Anitta", release_name: "C", release_group_mbid: "g3" }),
    ], artists);
    expect(found).toHaveLength(2);
    expect(found.find((entry) => entry.title.startsWith("A"))?.coverUrl).toContain("coverartarchive.org/release/r/9-250.jpg");
  });
});

describe("itunesArtwork", () => {
  const queen = { title: "Thank God It's Christmas... Again!", artist: "Queen", date: "2026-11-16" };
  const art = (over: Partial<ItunesAlbum>): ItunesAlbum => ({ collectionName: "Thank God It's Christmas... Again! - EP", artistName: "Queen",
    releaseDate: "2026-11-16T08:00:00Z", artworkUrl100: "https://is1-ssl.mzstatic.com/a/100x100bb.jpg", ...over });
  it("takes the store cover of the same record, at 250px", () => {
    expect(itunesArtwork([art({ artistName: "Marc Martel" }), art({})], queen)).toBe("https://is1-ssl.mzstatic.com/a/250x250bb.jpg");
  });
  it("refuses an older record with the same title", () => {
    expect(itunesArtwork([art({ releaseDate: "1984-02-27T08:00:00Z" })], queen)).toBeNull();
    expect(itunesArtwork([art({ collectionName: "The Works" })], queen)).toBeNull();
  });
});

describe("coverOf", () => {
  it("needs both the cover id and a release", () => {
    expect(coverOf(release({ caa_id: null, release_mbid: "r" }))).toBeNull();
    expect(coverOf(release({ caa_id: 5, caa_release_mbid: "c", release_mbid: "r" }))).toBe("https://coverartarchive.org/release/c/5-250.jpg");
  });
});
