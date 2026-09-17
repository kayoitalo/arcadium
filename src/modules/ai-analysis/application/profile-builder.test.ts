import { describe, it, expect, vi, beforeEach } from "vitest";
import { ProfileBuilder } from "./profile-builder";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    listeningEvent: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    artist: {
      findMany: vi.fn(),
    },
    // o gênero do catálogo da Apple entra como reserva de quem não tem tag
    album: {
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

    // A tem tag curada no MusicBrainz; B só tem tag descartável e depende
    // do gênero que o catálogo da Apple deu aos discos dele
    vi.mocked(prisma.artist.findMany).mockResolvedValue([
      { name: "Artist A", tags: "punk rock, pop punk, Japan" } as any,
      { name: "Artist B", tags: "Seen Live, Japan" } as any,
    ]);

    vi.mocked(prisma.album.findMany).mockResolvedValue([
      { itunesGenre: "hip hop", artist: { name: "Artist B" } } as any,
      { itunesGenre: "hip hop", artist: { name: "Artist B" } } as any,
      { itunesGenre: "pop", artist: { name: "Artist B" } } as any,
    ]);

    vi.mocked(prisma.listeningEvent.findFirst).mockResolvedValue({
      playedAt: new Date(),
    } as any);

    // ano de lançamento de cada audição; uma sem disco conhecido
    vi.mocked(prisma.listeningEvent.findMany).mockResolvedValue([
      { album: { releaseYear: 1977 } },
      { album: { releaseYear: 1979 } },
      { album: { releaseYear: 2003 } },
      { album: null },
    ] as any);

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
        // veio do catálogo, não do MusicBrainz: é o gênero mais frequente
        // entre os discos de B, e "pop" (uma aparição) fica de fora
        expect.objectContaining({ name: "hip hop" }),
      ])
    );
    expect(profile.topGenres.map((genre) => genre.name)).not.toContain("Seen Live");
    expect(profile.topGenres.map((genre) => genre.name)).not.toContain("pop");

    // décadas só das audições com ano conhecido, da mais ouvida para a menos
    expect(profile.eras).toEqual([
      { decade: "1970s", share: 0.667 },
      { decade: "2000s", share: 0.333 },
    ]);
  });

  it("leaves eras out when too few plays have a known release year", async () => {
    vi.mocked(prisma.listeningEvent.count).mockResolvedValue(10);
    (vi.mocked(prisma.listeningEvent.groupBy) as any).mockResolvedValue([]);
    vi.mocked(prisma.artist.findMany).mockResolvedValue([]);
    vi.mocked(prisma.album.findMany).mockResolvedValue([]);
    vi.mocked(prisma.listeningEvent.findMany).mockResolvedValue([
      { album: { releaseYear: 1994 } },
      ...Array.from({ length: 9 }, () => ({ album: null })),
    ] as any);

    const profile = await builder.buildProfile("user123", "all");

    // 10% de anos conhecidos: pouco para a piada virar retrato
    expect(profile.eras).toEqual([]);
  });
});
