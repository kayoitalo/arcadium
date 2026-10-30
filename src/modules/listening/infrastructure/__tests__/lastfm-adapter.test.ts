import { describe, expect, it, vi } from "vitest";
import { LastFmHistoryProvider } from "../lastfm-adapter";

describe("LastFmHistoryProvider", () => {
  it("filters out nowplaying items and parses completed tracks", async () => {
    const mockResponse = {
      recenttracks: {
        track: [
          {
            artist: { "#text": "Radiohead" },
            name: "Paranoid Android",
            album: { "#text": "OK Computer" },
            "@attr": { nowplaying: "true" },
          },
          {
            artist: { "#text": "Nirvana", mbid: "nirvana-mbid" },
            name: "Smells Like Teen Spirit",
            album: { "#text": "Nevermind", mbid: "release-mbid" },
            mbid: "recording-mbid",
            date: { uts: "1700000000", "#text": "20 Nov 2023, 00:00" },
          },
        ],
        "@attr": {
          user: "testuser",
          page: "1",
          perPage: "200",
          totalPages: "1",
          total: "1",
        },
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const provider = new LastFmHistoryProvider("dummy-key", "TestAgent/1.0");
    const result = await provider.fetchListens({ username: "testuser", page: 1 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      rawArtistName: "Nirvana",
      rawTrackName: "Smells Like Teen Spirit",
      rawAlbumName: "Nevermind",
      playedAtUtcSeconds: 1700000000,
      artistMbid: "nirvana-mbid",
      recordingMbid: "recording-mbid",
      releaseMbid: "release-mbid",
    });
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });
});
