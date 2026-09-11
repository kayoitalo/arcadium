import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ItunesCoverAdapter, normalizeTitle, sameAlbum, sameArtist } from "../itunes-cover-adapter";

const art = (size: string) => `https://is1-ssl.mzstatic.com/image/thumb/Music/x/${size}bb.jpg`;

describe("title matching", () => {
  it("drops editions, brackets and accents", () => {
    expect(normalizeTitle("Epiphany (Expanded Edition)")).toBe("epiphany");
    expect(normalizeTitle("Broken Youth - Single")).toBe("broken youth");
    expect(normalizeTitle("Canción [Remastered]")).toBe("cancion");
  });

  it("accepts the same artist written differently", () => {
    expect(sameArtist("Linkin Park", "LINKIN PARK")).toBe(true);
    expect(sameArtist("30 Seconds to Mars", "Thirty Seconds to Mars")).toBe(true);
    expect(sameArtist("Drake", "Drake & Future")).toBe(true);
    expect(sameArtist("Kiss", "Pop Smoke")).toBe(false);
  });

  it("accepts an edition of the same album but not a different album", () => {
    expect(sameAlbum("Meet the Woo 2", "Meet The Woo 2 (Deluxe)")).toBe(true);
    expect(sameAlbum("Views", "Views")).toBe(true);
    expect(sameAlbum("Meet the Woo 2", "Meet The Woo")).toBe(false);
    expect(sameAlbum("Views", "What a Time To Be Alive")).toBe(false);
  });
});

describe("ItunesCoverAdapter", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.restoreAllMocks());

  it("prefers the exact title and upsizes the artwork to 600px", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { artistName: "LINKIN PARK", collectionName: "Meteora (Deluxe Edition)", artworkUrl100: art("deluxe/100x100") },
          { artistName: "LINKIN PARK", collectionName: "Meteora", artworkUrl100: art("100x100") },
        ],
      }),
    } as Response);

    const result = await new ItunesCoverAdapter().findAlbumCover("Linkin Park", "Meteora");

    expect(result).toEqual({ url: art("600x600"), source: "itunes", entityType: "release", mbid: "" });
  });

  it("searches without the featuring credit and rejects other artists", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ artistName: "Someone Else", collectionName: "Cracker Island", artworkUrl100: art("100x100") }],
      }),
    } as Response);

    const result = await new ItunesCoverAdapter().findAlbumCover("Gorillaz", "Cracker Island (feat. Thundercat)");

    expect(result).toBeNull();
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(url.searchParams.get("term")).toBe("Gorillaz Cracker Island");
  });

  it("throws on HTTP errors so the album stays in the queue", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 403 } as Response);
    await expect(new ItunesCoverAdapter().findAlbumCover("Kiss", "Love Gun")).rejects.toThrow("HTTP 403");
  });
});
