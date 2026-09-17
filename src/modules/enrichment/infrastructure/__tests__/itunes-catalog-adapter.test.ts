import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ItunesCatalogAdapter,
  normalizeAppleGenre,
  normalizeTitle,
  sameArtist,
  sameTitle,
} from "../itunes-catalog-adapter";

const art = (size: string) => `https://is1-ssl.mzstatic.com/image/thumb/Music/x/${size}bb.jpg`;

const album = (fields: Record<string, unknown>) => ({
  wrapperType: "collection",
  collectionId: 1,
  artistName: "LINKIN PARK",
  collectionName: "Meteora",
  artworkUrl100: art("100x100"),
  ...fields,
});

const song = (fields: Record<string, unknown>) => ({
  wrapperType: "track",
  kind: "song",
  trackId: 10,
  artistName: "LINKIN PARK",
  trackName: "Numb",
  trackTimeMillis: 185_586,
  previewUrl: "https://audio.example/numb.m4a",
  trackViewUrl: "https://music.apple.com/br/album/numb",
  ...fields,
});

const respond = (results: unknown[]) =>
  vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ results }) } as Response);

// sem ritmo nos testes: a fila de 3s só existe para a API de verdade
const catalog = () => new ItunesCatalogAdapter({ country: "BR", minIntervalMs: 0 });

describe("title matching", () => {
  it("drops editions, brackets and accents", () => {
    expect(normalizeTitle("Epiphany (Expanded Edition)")).toBe("epiphany");
    expect(normalizeTitle("Broken Youth - Single")).toBe("broken youth");
    expect(normalizeTitle("Canción [Remastered]")).toBe("cancion");
  });

  it("drops the edition suffix Last.fm writes after a dash", () => {
    expect(normalizeTitle("Dreams - 2004 Remaster")).toBe("dreams");
    expect(normalizeTitle("Numb - Live")).toBe("numb");
    expect(normalizeTitle("Go Your Own Way - Remastered 2011")).toBe("go your own way");
    expect(sameTitle("The Chain - 2004 Remaster", "The Chain")).toBe(true);
  });

  it("keeps a dash that is part of the title", () => {
    expect(normalizeTitle("Doo Wop - That Thing")).toBe("doo wop that thing");
  });

  it("accepts the same artist written differently", () => {
    expect(sameArtist("Linkin Park", "LINKIN PARK")).toBe(true);
    expect(sameArtist("30 Seconds to Mars", "Thirty Seconds to Mars")).toBe(true);
    expect(sameArtist("Drake", "Drake & Future")).toBe(true);
    expect(sameArtist("Kiss", "Pop Smoke")).toBe(false);
  });

  it("accepts an edition of the same title but not a different one", () => {
    expect(sameTitle("Meet the Woo 2", "Meet The Woo 2 (Deluxe)")).toBe(true);
    expect(sameTitle("Views", "Views")).toBe(true);
    expect(sameTitle("Meet the Woo 2", "Meet The Woo")).toBe(false);
    expect(sameTitle("Views", "What a Time To Be Alive")).toBe(false);
  });
});

describe("normalizeAppleGenre", () => {
  it("maps Apple genre names onto the app vocabulary", () => {
    expect(normalizeAppleGenre("Hip-Hop/Rap")).toBe("hip hop");
    expect(normalizeAppleGenre("Alternative")).toBe("alternative rock");
    expect(normalizeAppleGenre("Hard Rock")).toBe("hard rock");
    expect(normalizeAppleGenre("R&B/Soul")).toBe("r&b");
  });

  it("drops genres that say nothing about the sound", () => {
    expect(normalizeAppleGenre("Singer/Songwriter")).toBeNull();
    expect(normalizeAppleGenre("Brazilian")).toBeNull();
    expect(normalizeAppleGenre(undefined)).toBeNull();
  });
});

describe("ItunesCatalogAdapter", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.restoreAllMocks());

  it("asks the configured storefront in English", async () => {
    respond([]);
    await catalog().searchAlbum("Gorillaz", "Cracker Island (feat. Thundercat)");

    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(url.searchParams.get("country")).toBe("BR");
    expect(url.searchParams.get("lang")).toBe("en_us");
    expect(url.searchParams.get("term")).toBe("Gorillaz Cracker Island");
  });

  it("prefers the exact album title and reads year, genre and link", async () => {
    respond([
      album({ collectionId: 2, collectionName: "Meteora (Deluxe Edition)", artworkUrl100: art("deluxe/100x100") }),
      album({
        collectionId: 1,
        releaseDate: "2003-03-25T08:00:00Z",
        primaryGenreName: "Hard Rock",
        collectionViewUrl: "https://music.apple.com/br/album/meteora",
      }),
    ]);

    expect(await catalog().searchAlbum("Linkin Park", "Meteora")).toEqual({
      collectionId: "1",
      name: "Meteora",
      artistName: "LINKIN PARK",
      artworkUrl: art("600x600"),
      appleMusicUrl: "https://music.apple.com/br/album/meteora",
      genre: "hard rock",
      releaseYear: 2003,
    });
  });

  it("rejects an album with the same title by someone else", async () => {
    respond([album({ artistName: "Vaecii & The Hollow Keys", collectionName: "Cracker Island - Single" })]);
    expect(await catalog().searchAlbum("Gorillaz", "Cracker Island")).toBeNull();
  });

  it("reads every track of an album from one lookup", async () => {
    respond([album({}), song({}), song({ trackId: 11, trackName: "Faint", trackTimeMillis: 162_600 })]);

    const tracks = await catalog().lookupTracks("1");

    expect(tracks.map((track) => [track.name, track.durationMs])).toEqual([
      ["Numb", 185_586],
      ["Faint", 162_600],
    ]);
    expect(tracks[0].previewUrl).toBe("https://audio.example/numb.m4a");
  });

  it("only returns a track preview when artist and title both match", async () => {
    respond([song({ trackName: "In the End" }), song({ artistName: "Someone", trackName: "Numb" })]);
    expect(await catalog().searchTrack("Linkin Park", "Numb")).toBeNull();

    respond([song({ trackName: "Numb (Live)" })]);
    expect((await catalog().searchTrack("Linkin Park", "Numb"))?.trackId).toBe("10");
  });

  it("throws on HTTP errors so the album stays in the queue", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(catalog().findAlbumCover("Kiss", "Love Gun")).rejects.toThrow("HTTP 403");
  });
});
