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
});
