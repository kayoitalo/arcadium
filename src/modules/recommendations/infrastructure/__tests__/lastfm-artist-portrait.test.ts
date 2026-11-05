import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const valid = "https://lastfm.freetls.fastly.net/i/u/300x300/synthetic.jpg";
const placeholder = "https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png";
beforeEach(() => { vi.resetModules(); vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => vi.unstubAllGlobals());
async function provider() { return new (await import("../lastfm-similar-adapter")).LastFmSimilarArtistProvider("synthetic-key", "fixture", { minIntervalMs: 0 }); }
const payload = (url = valid, name = "Artist", page = "https://www.last.fm/music/Artist") => ({ artist: { name, url: page, image: [{ "#text": url, size: "extralarge" }] } });
describe("Last.fm documented artist profile/image", () => {
  it("requests the exact profile without autocorrection, shares work and caches the photo", async () => {
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify(payload())));
    const api = await provider(); const [a,b] = await Promise.all([api.getArtistPortrait("Artist"), api.getArtistPortrait("Artist")]);
    expect(a).toMatchObject({ status: "READY", provider: "lastfm", artistName: "Artist", imageUrl: valid }); expect(b).toMatchObject({status:"READY", provider:"lastfm", imageUrl:valid});
    await api.getArtistPortrait("Artist"); expect(fetch).toHaveBeenCalledOnce();
    const query = new URL(String(vi.mocked(fetch).mock.calls[0][0])).searchParams;
    expect(query.get("method")).toBe("artist.getinfo"); expect(query.get("autocorrect")).toBe("0"); expect(query.has("username")).toBe(false);
  });
  it.each(["", placeholder, "https://evil.test/image.jpg"])("keeps the verified profile when the image is unavailable (%s)", async url => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(payload(url))));
    expect(await (await provider()).getArtistPortrait("Artist")).toMatchObject({ status: "MISSING", reason: url === placeholder ? "PLACEHOLDER" : "NO_IMAGE", profile: { sourceUrl: "https://www.last.fm/music/Artist" } });
  });
  it.each([payload(valid, "Tribute"), payload(valid, "Artist", "https://www.last.fm/music/Wrong")])("rejects mismatched name or profile", async data => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(data)));
    expect(await (await provider()).getArtistPortrait("Artist")).toMatchObject({ reason: "AMBIGUOUS" });
  });
  it("does no requests without the existing key and never caches a temporary error as missing", async () => {
    const { LastFmSimilarArtistProvider } = await import("../lastfm-similar-adapter");
    expect(await new LastFmSimilarArtistProvider("").getArtistPortrait("Artist")).toMatchObject({ reason: "NOT_CONFIGURED" });
    expect(fetch).not.toHaveBeenCalled(); vi.mocked(fetch).mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(new Response(JSON.stringify(payload())));
    const api = await provider(); await expect(api.getArtistPortrait("Artist")).rejects.toThrow();
    expect(await api.getArtistPortrait("Artist")).toMatchObject({ status: "READY" }); expect(fetch).toHaveBeenCalledTimes(2);
  });
});
