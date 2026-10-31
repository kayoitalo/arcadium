import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpotifyAdapter } from "../spotify-adapter";

describe("SpotifyAdapter", () => {
  let adapter: SpotifyAdapter;

  beforeEach(() => {
    adapter = new SpotifyAdapter();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns fallback web search URL when no access token is provided", async () => {
    const result = await adapter.searchTrackUri("The Long Road North", "Cult of Luna");

    expect(result.uri).toBeNull();
    expect(result.webUrl).toContain("https://open.spotify.com/search/");
    expect(result.webUrl).toContain("Cult%20of%20Luna");
  });

  it("returns Spotify track URI when search API matches track", async () => {
    const mockTrackResponse = {
      tracks: {
        items: [
          {
            uri: "spotify:track:6rqhFgbbK8udwRJPuXg1uv",
            name: "The Long Road North",
            artists: [{ name: "Cult of Luna" }],
            external_urls: {
              spotify: "https://open.spotify.com/track/6rqhFgbbK8udwRJPuXg1uv",
            },
          },
        ],
      },
    };

    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockTrackResponse,
    });

    const result = await adapter.searchTrackUri("The Long Road North", "Cult of Luna", "valid-access-token");

    expect(result.uri).toBe("spotify:track:6rqhFgbbK8udwRJPuXg1uv");
    expect(result.webUrl).toBe("https://open.spotify.com/track/6rqhFgbbK8udwRJPuXg1uv");
  });

  it("creates a private playlist via Spotify API", async () => {
    const mockPlaylistResponse = {
      id: "playlist-12345",
      name: "Arcadium Test Playlist",
      external_urls: {
        spotify: "https://open.spotify.com/playlist/playlist-12345",
      },
    };

    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPlaylistResponse,
    });

    const result = await adapter.createPlaylist(
      "valid-access-token",
      "user-123",
      "Arcadium Test Playlist",
      "Test description"
    );

    expect(result).not.toBeNull();
    expect(result?.id).toBe("playlist-12345");
    expect(result?.webUrl).toBe("https://open.spotify.com/playlist/playlist-12345");
    expect(fetch).toHaveBeenCalledWith("https://api.spotify.com/v1/me/playlists", expect.objectContaining({
      method: "POST", body: JSON.stringify({ name: "Arcadium Test Playlist", description: "Test description", public: false }),
    }));
  });

  it("batches track URIs in chunks of 100 when adding to playlist", async () => {
    const trackUris = Array.from({ length: 150 }, (_, i) => `spotify:track:uri-${i}`);

    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ snapshot_id: "snapshot-xyz" }),
    });

    const result = await adapter.addTracksToPlaylist("valid-access-token", "playlist-12345", trackUris);

    expect(result.addedCount).toBe(150);

    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(1, "https://api.spotify.com/v1/playlists/playlist-12345/items", expect.objectContaining({
      body: JSON.stringify({ uris: trackUris.slice(0, 100) }),
    }));
    expect(fetch).toHaveBeenNthCalledWith(2, "https://api.spotify.com/v1/playlists/playlist-12345/items", expect.objectContaining({
      body: JSON.stringify({ uris: trackUris.slice(100) }),
    }));
  });

  it("searches beyond a wrong version and rejects tribute performers", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ tracks: { items: [
      { name: "Dreams (Live)", artists: [{ name: "Fleetwood Mac" }], uri: "spotify:track:live" },
      { name: "Dreams", artists: [{ name: "Fleetwood Mac Tribute" }], uri: "spotify:track:tribute" },
      { name: "Dreams", artists: [{ name: "Fleetwood Mac" }], uri: "spotify:track:studio" },
    ] } }) } as Response);
    expect((await adapter.searchTrackUri("Dreams", "Fleetwood Mac", "token")).uri).toBe("spotify:track:studio");
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(url.searchParams.get("limit")).toBe("10");
  });
});

describe("SpotifyAdapter — autorização recusada", () => {
  const adapter = new SpotifyAdapter();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lança SpotifyAuthError no 401 da busca, em vez de fingir que não achou", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401 }) as Response));

    await expect(adapter.searchTrackUri("Blitzkrieg Bop", "Ramones", "token-revogado")).rejects.toMatchObject({
      name: "SpotifyAuthError",
    });
  });

  it("lança SpotifyAuthError no 401 da criação de playlist", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401 }) as Response));

    await expect(adapter.createPlaylist("token", "user", "Titulo", "Descrição")).rejects.toMatchObject({
      name: "SpotifyAuthError",
    });
  });

  it("segue devolvendo null quando a faixa realmente não existe", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ tracks: { items: [] } }),
    }) as Response));

    const result = await adapter.searchTrackUri("Faixa Inexistente", "Artista", "token-valido");
    expect(result.uri).toBeNull();
    expect(result.webUrl).toContain("open.spotify.com/search");
  });

  it("codifica a query da busca em vez de deixar espaço cru na URL", async () => {
    let requestedUrl = "";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        requestedUrl = String(input);
        return { ok: true, status: 200, json: async () => ({ tracks: { items: [] } }) } as Response;
      }),
    );

    await adapter.searchTrackUri("LALA", "Myke Towers", "token");

    const url = requestedUrl;
    // o espaço entre os filtros precisa ir codificado
    expect(url).not.toMatch(/q=[^&]* [^&]*/);
  });
});
