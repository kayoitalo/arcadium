import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const id = "1a2b3c4d5e6f7g8h9i0jKl";
const reference = { artistName: "Artist", trackName: "Song (Live)" };
const artist = (artistId = id, name = "Artist") => ({ id: artistId, name });
const search = (items = [{ name: "Song (Live)", artists: [artist()] }]) => ({ tracks: { items, next: null } });
const profile = (images = [{ url: "https://i.scdn.co/image/Synthetic", width: 640, height: 640 }]) => ({ ...artist(), images });
const ok = (data: unknown) => new Response(JSON.stringify(data));
const token = () => ok({ access_token: "synthetic-server-token", token_type: "Bearer", expires_in: 3600 });
beforeEach(() => { vi.resetModules(); vi.stubGlobal("fetch", vi.fn()); vi.stubEnv("SPOTIFY_CLIENT_ID", "synthetic-id"); vi.stubEnv("SPOTIFY_CLIENT_SECRET", "synthetic-secret"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
async function adapter() { return new (await import("../spotify-artist-portrait-adapter")).SpotifyArtistPortraitAdapter(0); }
function responses(last = profile()) { vi.mocked(fetch).mockResolvedValueOnce(token()).mockResolvedValueOnce(ok(search())).mockResolvedValueOnce(ok(last)); }

describe("Spotify artist photos within existing provider scope", () => {
  it("uses existing app credentials and matches artist plus exact observed version before fetching the profile", async () => {
    responses(); const api = await adapter(); const [photo, same] = await Promise.all([api.lookup(reference), api.lookup(reference)]);
    expect(photo).toMatchObject({ status: "READY", provider: "spotify", artistId: id, sourceUrl: `https://open.spotify.com/artist/${id}` });
    expect(same).toEqual(photo); await api.lookup(reference); expect(fetch).toHaveBeenCalledTimes(3);
    const calls = vi.mocked(fetch).mock.calls;
    expect(calls[0][0]).toBe("https://accounts.spotify.com/api/token");
    expect(String(calls[0][1]?.body)).toBe("grant_type=client_credentials");
    const query = new URL(String(calls[1][0])).searchParams;
    expect(query.get("q")).toBe('artist:"Artist" track:"Song (Live)"'); expect(query.get("limit")).toBe("10"); expect(query.get("market")).toBe("BR");
    expect(calls[2][0]).toBe(`https://api.spotify.com/v1/artists/${id}`);
    expect(JSON.stringify(photo)).not.toContain("synthetic-server-token");
  });
  it("makes no calls without configured credentials or an owned track", async () => {
    const api = await adapter(); expect(await api.lookup({ ...reference, trackName: "" })).toMatchObject({ reason: "NO_REFERENCE" });
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", ""); expect(await api.lookup(reference)).toMatchObject({ reason: "NOT_CONFIGURED" }); expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["version", "tribute", "homonyms"])("refuses %s without a broad artist-name fallback", async problem => {
    const tracks = problem === "version" ? [{ name: "Song", artists: [artist()] }]
      : problem === "tribute" ? [{ name: reference.trackName, artists: [artist(id, "Artist Tribute")] }]
      : [{ name: reference.trackName, artists: [artist()] }, { name: reference.trackName, artists: [artist("2a2b3c4d5e6f7g8h9i0jKl")] }];
    vi.mocked(fetch).mockResolvedValueOnce(token()).mockResolvedValueOnce(ok(search(tracks)));
    expect(await (await adapter()).lookup(reference)).toMatchObject({ status: "MISSING", reason: problem === "homonyms" ? "AMBIGUOUS" : "NO_MATCH" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("allows duplicate releases by the same profile and never follows search pagination", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(token()).mockResolvedValueOnce(ok({ tracks: { items: [...search().tracks.items, ...search().tracks.items], next: "https://api.spotify.com/v1/search?offset=10" } })).mockResolvedValueOnce(ok(profile()));
    expect(await (await adapter()).lookup(reference)).toMatchObject({ status: "READY" }); expect(fetch).toHaveBeenCalledTimes(3);
  });
  it.each(["id", "name", "image"])("refuses inconsistent profile %s", async problem => {
    responses(problem === "id" ? { ...profile(), id: "2a2b3c4d5e6f7g8h9i0jKl" } : problem === "name" ? { ...profile(), name: "Different artist" } : profile([{ url: "https://evil.test/a.jpg", width: 640, height: 640 }]));
    expect(await (await adapter()).lookup(reference)).toMatchObject({ status: "MISSING" });
  });
  it("does not retry a failed call or start other photos concurrently", async () => {
    let finish!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); const api = await adapter(); const running = api.lookup(reference);
    await expect(api.lookup({ ...reference, artistName: "Other" })).rejects.toThrow(); finish(new Response("", { status: 503 }));
    await expect(running).rejects.toThrow(); await expect(api.lookup(reference)).rejects.toThrow(); expect(fetch).toHaveBeenCalledOnce();
  });
  it("discards an expired app token on 401 without an automatic retry", async () => {
    vi.useFakeTimers(); vi.mocked(fetch).mockResolvedValueOnce(token()).mockResolvedValueOnce(new Response("", { status: 401 })); const api = await adapter();
    await expect(api.lookup(reference)).rejects.toThrow(); expect(fetch).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(30001); responses(); expect(await api.lookup(reference)).toMatchObject({ status: "READY" }); expect(fetch).toHaveBeenCalledTimes(5);
  });
  it("reuses the server token across different artists while keeping reference-specific cache", async () => {
    responses(); const api = await adapter(); await api.lookup(reference);
    vi.mocked(fetch).mockResolvedValueOnce(ok(search([]))); expect(await api.lookup({ ...reference, trackName: "Other" })).toMatchObject({ reason: "NO_MATCH" });
    expect(vi.mocked(fetch).mock.calls.filter(call => String(call[0]).includes("accounts.spotify.com"))).toHaveLength(1);
  });
});
