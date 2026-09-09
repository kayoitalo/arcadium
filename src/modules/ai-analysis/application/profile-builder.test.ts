import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfileBuilder } from "./profile-builder";
import { prisma } from "@/lib/db/prisma";

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

    vi.mocked(prisma.listeningEvent.count).mockResolvedValue(100);

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

    vi.mocked(prisma.artist.findMany).mockResolvedValue([
      { name: "Artist A", tags: "punk rock, pop punk, Japan" } as any,
      { name: "Artist B", tags: "hip hop, trap latino, Seen Live" } as any,
    ]);

    vi.mocked(prisma.listeningEvent.findFirst).mockResolvedValue({
      playedAt: new Date(),
    } as any);

    const profile = await builder.buildProfile("user123", "30d");

    expect((profile as any).userId).toBeUndefined();
    expect((profile as any).email).toBeUndefined();

    expect(profile.period).toBe("30d");
    expect(profile.totalPlays).toBe(100);
    expect(profile.topArtists).toHaveLength(2);
    expect(profile.topArtists[0].name).toBe("Artist A");
    expect(profile.topArtists[0].share).toBe(0.6);

    expect(profile.topGenres).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "punk rock" }),
        expect.objectContaining({ name: "hip hop" }),
      ])
    );
  });
});
