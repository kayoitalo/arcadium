import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("shared Spotify cooldown", () => {
  it.each(["seconds", "date", "missing"])("honors Retry-After %s across photos, playlists and tokens", async kind => {
    const retry = kind === "seconds" ? "7200" : kind === "date" ? new Date(Date.now() + 7200000).toUTCString() : null;
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 429, headers: retry ? { "Retry-After": retry } : {} }));
    const { spotifyFetch } = await import("../spotify-http"); await spotifyFetch("https://api.spotify.com/v1/search");
    vi.advanceTimersByTime(kind === "missing" ? 30000 : 3600000);
    await expect(spotifyFetch("https://api.spotify.com/v1/me/playlists", { method: "POST" })).rejects.toThrow();
    await expect(spotifyFetch("https://accounts.spotify.com/api/token", { method: "POST" })).rejects.toThrow(); expect(fetch).toHaveBeenCalledOnce();
  });
});
