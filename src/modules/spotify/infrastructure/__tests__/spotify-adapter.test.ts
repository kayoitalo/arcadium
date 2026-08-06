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
      name: "Music Intelligence Test Playlist",
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
      "Music Intelligence Test Playlist",
      "Test description"
    );

    expect(result).not.toBeNull();
    expect(result?.id).toBe("playlist-12345");
    expect(result?.webUrl).toBe("https://open.spotify.com/playlist/playlist-12345");
  });

  it("batches track URIs in chunks of 100 when adding to playlist", async () => {
    const trackUris = Array.from({ length: 150 }, (_, i) => `spotify:track:uri-${i}`);

    (globalThis.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ snapshot_id: "snapshot-xyz" }),
    });

    const result = await adapter.addTracksToPlaylist("valid-access-token", "playlist-12345", trackUris);

    expect(result.addedCount).toBe(150);
    // Should make 2 fetch calls for 150 items (100 in chunk 1, 50 in chunk 2)
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
