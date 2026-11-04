import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
beforeEach(() => { vi.resetModules(); vi.stubGlobal("fetch", vi.fn()); vi.stubEnv("SPOTIFY_CLIENT_ID", "fixture-id"); vi.stubEnv("SPOTIFY_CLIENT_SECRET", "fixture-secret"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
describe("application catalog token", () => {
  it("coalesces concurrent authorization and renews before expiry", async () => {
    vi.useFakeTimers(); vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ access_token: "fixture-token", token_type: "Bearer", expires_in: 100 })));
    // A fresh body is required for each mocked response, as with the real fetch.
    vi.mocked(fetch).mockImplementation(async () => new Response(JSON.stringify({ access_token: "fixture-token", token_type: "Bearer", expires_in: 100 })));
    const { spotifyCatalogToken } = await import("../spotify-catalog-token");
    expect(await Promise.all([spotifyCatalogToken(), spotifyCatalogToken()])).toEqual(["fixture-token", "fixture-token"]); expect(fetch).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(90001); await spotifyCatalogToken(); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("does not cache credentials errors or silently accept malformed tokens", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("", { status: 403 })).mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "token", expires_in: -1 })));
    const { spotifyCatalogToken } = await import("../spotify-catalog-token");
    await expect(spotifyCatalogToken()).rejects.toThrow(); await expect(spotifyCatalogToken()).rejects.toThrow(); expect(fetch).toHaveBeenCalledTimes(2);
  });
});
