import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfileBuilder } from "./profile-builder";
import { prisma } from "@/lib/db/prisma";

// Mock the prisma client
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    listeningEvent: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findFirst: vi.fn(),
    },
    artist: {
      findMany: vi.fn(),
    },
  },
}));

describe("ProfileBuilder", () => {
  let builder: ProfileBuilder;

  beforeEach(() => {
    builder = new ProfileBuilder();
    vi.clearAllMocks();
  });

  it("builds a pseudonymized profile from database aggregations", async () => {
    // Mock count
    vi.mocked(prisma.listeningEvent.count).mockResolvedValue(100);

    // Mock groupBy for unique artists/tracks and top artists
    (vi.mocked(prisma.listeningEvent.groupBy) as any).mockImplementation((args: any) => {
      if (args._min?.playedAt) {
        return Promise.resolve([
          { rawArtistName: "Artist A", _min: { playedAt: new Date() }, _count: { id: 60 } },
          { rawArtistName: "Artist B", _min: { playedAt: new Date() }, _count: { id: 40 } },
        ]);
      }
      if (args.by.includes("rawTrackName")) {
        return Promise.resolve([
          { rawArtistName: "Artist A", rawTrackName: "Track A", _count: { id: 20 } },
          { rawArtistName: "Artist B", rawTrackName: "Track B", _count: { id: 10 } },
        ]);
      }
      return Promise.resolve([
        { rawArtistName: "Artist A", _count: { id: 60 } },
        { rawArtistName: "Artist B", _count: { id: 40 } },
      ]);
    });

    // Mock artist query for tags
    vi.mocked(prisma.artist.findMany).mockResolvedValue([
      { name: "Artist A", tags: "genre one, genre two" } as any,
      { name: "Artist B", tags: "genre three, genre four" } as any,
    ]);

    // Mock findFirst for first listen check
    vi.mocked(prisma.listeningEvent.findFirst).mockResolvedValue({
      playedAt: new Date(),
    } as any);

    const profile = await builder.buildProfile("user123", "30d");

    // Identity data should not be present
    expect((profile as any).userId).toBeUndefined();
    expect((profile as any).email).toBeUndefined();

    // Verify basic fields
    expect(profile.period).toBe("30d");
    expect(profile.totalPlays).toBe(100);
    expect(profile.topArtists).toHaveLength(2);
    expect(profile.topArtists[0].name).toBe("Artist A");
    expect(profile.topArtists[0].share).toBe(0.6); // 60 / 100

    // Verify genres
    expect(profile.topGenres).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "genre one" }),
        expect.objectContaining({ name: "genre three" }),
      ])
    );
  });
});
