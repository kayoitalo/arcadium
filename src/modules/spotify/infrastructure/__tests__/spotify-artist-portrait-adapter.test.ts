import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const id = "1a2b3c4d5e6f7g8h9i0jKl"; const otherId = "2a2b3c4d5e6f7g8h9i0jKl";
const reference = { artistName: "Artist", trackName: "Song (Live)" };
const artist = (artistId = id, name = "Artist") => ({ id: artistId, name });
const profile = (artistId = id, name = "Artist", url = "https://i.scdn.co/image/Synthetic") => ({ ...artist(artistId, name), images: [{ url, width: 640, height: 640 }] });
const artists = (items = [profile()]) => ({ artists: { items } });
const tracks = (items = [{ name: reference.trackName, artists: [artist()] }]) => ({ tracks: { items, next: null } });
const ok = (data: unknown) => new Response(JSON.stringify(data));
const token = () => ok({ access_token: "synthetic-server-token", token_type: "Bearer", expires_in: 3600 });
beforeEach(() => { vi.resetModules(); vi.stubGlobal("fetch", vi.fn()); vi.stubEnv("SPOTIFY_CLIENT_ID", "synthetic-id"); vi.stubEnv("SPOTIFY_CLIENT_SECRET", "synthetic-secret"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
async function adapter() { return new (await import("../spotify-artist-portrait-adapter")).SpotifyArtistPortraitAdapter(0); }
function responses(data = artists()) { vi.mocked(fetch).mockResolvedValueOnce(token()).mockResolvedValueOnce(ok(data)); }

describe("Spotify artist photos", () => {
  it("searches the artist directly, coalesces/cache lookups and does not require a recording version", async () => {
    responses(); const api = await adapter(); const [photo, same] = await Promise.all([api.lookup(reference), api.lookup(reference)]);
    expect(photo).toMatchObject({ status: "READY", provider: "spotify", artistId: id, sourceUrl: `https://open.spotify.com/artist/${id}` });
    expect(same).toEqual(photo); await api.lookup(reference); expect(fetch).toHaveBeenCalledTimes(2);
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls[0][0]).toBe("https://accounts.spotify.com/api/token");
    expect(String(calls[0][1]?.body)).toBe("grant_type=client_credentials");
    const query = new URL(String(calls[1][0])).searchParams;
    expect(query.get("type")).toBe("artist"); expect(query.get("q")).toBe('artist:"Artist"'); expect(query.get("limit")).toBe("10");
    expect(JSON.stringify(photo)).not.toContain("synthetic-server-token");
  });
  it.each(["", 'Song "alternate title" (Live)'])("does not gate a unique profile on track %s", async trackName => {
    responses(); expect(await (await adapter()).lookup({ ...reference, trackName })).toMatchObject({ status: "READY" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("makes no calls without configured credentials or an artist name", async () => {
    const api = await adapter(); expect(await api.lookup({ ...reference, artistName: "" })).toMatchObject({ reason: "NO_REFERENCE" });
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", ""); expect(await api.lookup(reference)).toMatchObject({ reason: "NOT_CONFIGURED" }); expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects a tribute and other nonmatching artist names", async () => {
    responses(artists([profile(id, "Artist Tribute"), profile(otherId, "Another Artist")]));
    expect(await (await adapter()).lookup(reference)).toMatchObject({ status: "MISSING", reason: "NO_MATCH" }); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("uses the observed track only to disambiguate matching artist profiles", async () => {
    responses(artists([profile(), profile(otherId)])); vi.mocked(fetch).mockResolvedValueOnce(ok(tracks([{ name: reference.trackName, artists: [artist(otherId)] }])));
    expect(await (await adapter()).lookup(reference)).toMatchObject({ status: "READY", artistId: otherId }); expect(fetch).toHaveBeenCalledTimes(3);
    expect(new URL(String(vi.mocked(fetch).mock.calls[2][0])).searchParams.get("type")).toBe("track");
  });
  it.each(["version", "outside-candidates", "homonyms"])("keeps unresolved ambiguity for %s", async problem => {
    responses(artists([profile(), profile(otherId)]));
    const found = problem === "version" ? [{ name: "Song", artists: [artist()] }]
      : problem === "outside-candidates" ? [{ name: reference.trackName, artists: [artist("3a2b3c4d5e6f7g8h9i0jKl")] }]
      : [{ name: reference.trackName, artists: [artist(), artist(otherId)] }];
    vi.mocked(fetch).mockResolvedValueOnce(ok(tracks(found)));
    expect(await (await adapter()).lookup(reference)).toMatchObject({ status: "MISSING", reason: "AMBIGUOUS" }); expect(fetch).toHaveBeenCalledTimes(3);
  });
  it("does not disambiguate without a usable track or follow pagination", async () => {
    responses({ artists: { items: [profile(), profile(otherId)], next: "https://api.spotify.com/v1/search?offset=10" } } as ReturnType<typeof artists>);
    expect(await (await adapter()).lookup({ ...reference, trackName: "" })).toMatchObject({ reason: "AMBIGUOUS" }); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("rejects image hosts outside the existing CDN", async () => {
    responses(artists([profile(id, "Artist", "https://evil.test/image.jpg")]));
    expect(await (await adapter()).lookup(reference)).toMatchObject({ reason: "NO_IMAGE" });
  });
  it("does not retry a failed call or start other photos concurrently", async () => {
    let finish!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); const api = await adapter(); const running = api.lookup(reference);
    await expect(api.lookup({ ...reference, artistName: "Other" })).rejects.toThrow(); finish(new Response("", { status: 503 }));
    await expect(running).rejects.toThrow(); await expect(api.lookup(reference)).rejects.toThrow(); expect(fetch).toHaveBeenCalledOnce();
  });
  it("discards an expired app token on 401 without automatic retry", async () => {
    vi.useFakeTimers(); vi.mocked(fetch).mockResolvedValueOnce(token()).mockResolvedValueOnce(new Response("", { status: 401 })); const api = await adapter();
    await expect(api.lookup(reference)).rejects.toThrow(); expect(fetch).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(30001); responses(); expect(await api.lookup(reference)).toMatchObject({ status: "READY" }); expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("reuses the server token across different references", async () => {
    responses(); const api = await adapter(); await api.lookup(reference);
    vi.mocked(fetch).mockResolvedValueOnce(ok(artists([]))); expect(await api.lookup({ ...reference, trackName: "Other" })).toMatchObject({ reason: "NO_MATCH" });
    expect(vi.mocked(fetch).mock.calls.filter(call => String(call[0]).includes("accounts.spotify.com"))).toHaveLength(1);
  });
});
