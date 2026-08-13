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
      if (args.by.includes("rawTrackName")) {
        return Promise.resolve([
          { rawArtistName: "Deftones", rawTrackName: "Change", _count: { id: 20 } },
          { rawArtistName: "Gojira", rawTrackName: "Stranded", _count: { id: 10 } },
        ]);
      }
      return Promise.resolve([
        { rawArtistName: "Deftones", _count: { id: 60 } },
        { rawArtistName: "Gojira", _count: { id: 40 } },
      ]);
    });

    // Mock artist query for tags
    vi.mocked(prisma.artist.findMany).mockResolvedValue([
      { name: "Deftones", tags: "alternative metal, nu metal" } as any,
      { name: "Gojira", tags: "progressive metal, death metal" } as any,
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
    expect(profile.topArtists[0].name).toBe("Deftones");
    expect(profile.topArtists[0].share).toBe(0.6); // 60 / 100

    // Verify genres
    expect(profile.topGenres).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "alternative metal" }),
        expect.objectContaining({ name: "progressive metal" }),
      ])
    );
  });
});
