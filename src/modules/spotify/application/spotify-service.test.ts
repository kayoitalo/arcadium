import { describe, expect, it, vi } from "vitest";
import { SpotifyService } from "./spotify-service";
import { SpotifyAdapter } from "../infrastructure/spotify-adapter";

describe("playlist export", () => {
  it.each([0, 1, 2])("reports actual additions (%i), distinct from resolved matches", async (addedCount) => {
    const adapter = {
      searchTrackUri: vi.fn().mockResolvedValue({ uri: "spotify:track:exact", webUrl: "https://open.spotify.com/track/exact" }),
      createPlaylist: vi.fn().mockResolvedValue({ id: "playlist", webUrl: "https://open.spotify.com/playlist/playlist" }),
      addTracksToPlaylist: vi.fn().mockResolvedValue({ addedCount }),
    };
    const result = await new SpotifyService(adapter as unknown as SpotifyAdapter).exportTracks([
      { trackName: "One", artistName: "Band" }, { trackName: "Two", artistName: "Band" },
    ], "token", "user");
    expect(result).toMatchObject({ mode: "SPOTIFY_API", resolvedCount: 2, addedCount, partial: addedCount < 2 });
    expect(adapter.addTracksToPlaylist).toHaveBeenCalledOnce();
  });
});
