import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MusicBrainzAdapter } from "../musicbrainz-adapter";

describe("MusicBrainzAdapter", () => {
  let adapter: MusicBrainzAdapter;

  beforeEach(() => {
    adapter = new MusicBrainzAdapter("SpotStatsTest/1.0");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses artist metadata accurately when exact match is found", async () => {
    const mockArtistResponse = {
      artists: [
        {
          id: "cc197b91-446d-4979-9f62-912ed57db323",
          name: "Radiohead",
          country: "GB",
          type: "Group",
          disambiguation: "British rock band",
          score: 100,
          tags: [
            { name: "alternative rock", count: 45 },
            { name: "art rock", count: 30 },
          ],
        },
      ],
    };

    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockArtistResponse,
    });

    const result = await adapter.searchArtist("Radiohead");

    expect(result).not.toBeNull();
    expect(result?.mbid).toBe("cc197b91-446d-4979-9f62-912ed57db323");
    expect(result?.country).toBe("GB");
    expect(result?.type).toBe("Group");
    expect(result?.score).toBe(1.0);
    expect(result?.tags).toEqual(["alternative rock", "art rock"]);
  });

  it("returns null when confidence score is below threshold", async () => {
    const mockLowConfidenceResponse = {
      artists: [
        {
          id: "some-random-id",
          name: "Unrelated Band",
          score: 20,
        },
      ],
    };

    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockLowConfidenceResponse,
    });

    const result = await adapter.searchArtist("Radiohead");
    expect(result).toBeNull();
  });

  it("parses release year and primary type for albums", async () => {
    const mockAlbumResponse = {
      releases: [
        {
          id: "album-mbid-123",
          title: "OK Computer",
          date: "1997-05-21",
          "release-group": {
            id: "release-group-mbid-456",
            "primary-type": "Album",
          },
        },
      ],
    };

    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumResponse,
    });

    const result = await adapter.searchAlbum("OK Computer", "cc197b91-446d-4979-9f62-912ed57db323");

    expect(result).not.toBeNull();
    expect(result?.mbid).toBe("album-mbid-123");
    expect(result?.releaseGroupMbid).toBe("release-group-mbid-456");
    expect(result?.releaseYear).toBe(1997);
    expect(result?.primaryType).toBe("Album");
  });
});
