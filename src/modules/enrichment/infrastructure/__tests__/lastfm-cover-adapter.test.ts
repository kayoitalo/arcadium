import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LastFmCoverAdapter } from "../lastfm-cover-adapter";

describe("LastFmCoverAdapter", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.restoreAllMocks());

  it("returns the largest available album image", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ album: { image: [
      { size: "large", "#text": "https://images.example/large.jpg" },
      { size: "mega", "#text": "https://images.example/mega.jpg" },
    ] } }) } as Response);
    const result = await new LastFmCoverAdapter("api-key").findAlbumCover("Artist", "Album");
    expect(result).toEqual({ url: "https://images.example/mega.jpg", source: "lastfm", entityType: "release", mbid: "" });
  });

  it("does not call Last.fm without a configured key", async () => {
    expect(await new LastFmCoverAdapter("").findAlbumCover("Artist", "Album")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("resolves artwork without Apple audio, coalesces calls and preserves version identity", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ track: {
      name: "Rare Song", artist: { name: "Rare Band" }, album: { image: [{ size: "mega", "#text": "https://images.example/rare.jpg" }] },
    } }) } as Response);
    const adapter = new LastFmCoverAdapter("cover-test-key");
    const [one, two] = await Promise.all([adapter.findTrackCover("Rare Band", "Rare Song"), adapter.findTrackCover("Rare Band", "Rare Song")]);
    expect(one?.url).toBe("https://images.example/rare.jpg"); expect(two).toEqual(one);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(new URL(String(vi.mocked(fetch).mock.calls[0][0])).searchParams.get("autocorrect")).toBe("0");
    expect(await adapter.findTrackCover("Rare Band", "Rare Song")).toEqual(one);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await adapter.findTrackCover("Rare Band", "Rare Song (Live)")).toBeNull();
  });
});
