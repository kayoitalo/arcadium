import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  artistCount: vi.fn(), albumCount: vi.fn(), trackCount: vi.fn(),
  artists: vi.fn(), albums: vi.fn(), recent: vi.fn(),
  tracks: vi.fn(), trackUpdate: vi.fn(), albumUpdate: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  artist: { count: mocks.artistCount, findMany: mocks.artists },
  album: { count: mocks.albumCount, findMany: mocks.albums, update: mocks.albumUpdate },
  track: { count: mocks.trackCount, findMany: mocks.tracks, update: mocks.trackUpdate }, listeningEvent: { groupBy: mocks.recent },
} }));
import { EnrichmentService } from "./enrichment-service";
import type { ItunesCatalogAdapter } from "../infrastructure/itunes-catalog-adapter";
beforeEach(() => {
  vi.resetAllMocks();
  for (const count of [mocks.artistCount, mocks.albumCount, mocks.trackCount]) count.mockResolvedValue(0);
  for (const query of [mocks.artists, mocks.albums, mocks.recent]) query.mockResolvedValue([]);
});
describe("owner-scoped enrichment", () => {
  it("never includes another account in coverage totals", async () => {
    await new EnrichmentService().getCoverageStats("owner");
    for (const count of [mocks.artistCount, mocks.albumCount, mocks.trackCount]) {
      for (const [args] of count.mock.calls) expect(args.where.listeningEvents).toEqual({ some: { userId: "owner" } });
    }
  });
  it("scopes recent and fallback queues to the owner for all enrichment actions", async () => {
    const service = new EnrichmentService();
    await service.enrichUnresolvedArtists("owner", 2);
    await service.enrichAlbumsFromCatalog("owner", 2);
    for (const [args] of mocks.recent.mock.calls) expect(args.where.userId).toBe("owner");
    for (const query of [mocks.artists, mocks.albums]) {
      for (const [args] of query.mock.calls) expect(args.where.listeningEvents).toEqual({ some: { userId: "owner" } });
    }
  });
  it("keeps the Conversa's catalog cover when no better cover turns up", async () => {
    mocks.albums.mockResolvedValue([{ id: "album", name: "Angels Cry", mbid: null, releaseGroupMbid: null, coverUrl: "https://is1.mzstatic.com/x.jpg", coverSource: "itunes-track", artist: { name: "Angra" } }]);
    const none = { findAlbumCover: vi.fn().mockResolvedValue(null) };
    await new EnrichmentService(undefined, undefined, undefined, [none]).enrichMissingAlbumCovers("owner", 1);
    expect(mocks.albumUpdate).toHaveBeenCalledExactlyOnceWith({ where: { id: "album" }, data: { coverFetchedAt: expect.any(Date) } });
  });
  it("still clears an unavailable archive link when nothing replaces it", async () => {
    mocks.albums.mockResolvedValue([{ id: "album", name: "Disco", mbid: null, releaseGroupMbid: null, coverUrl: "https://coverartarchive.org/release/x/front", coverSource: "cover-art-archive", artist: { name: "Banda" } }]);
    const none = { findAlbumCover: vi.fn().mockResolvedValue(null) };
    await new EnrichmentService(undefined, undefined, undefined, [none]).enrichMissingAlbumCovers("owner", 1);
    expect(mocks.albumUpdate.mock.calls[0][0].data).toMatchObject({ coverUrl: null, coverSource: null });
  });
  it("does not borrow a live recording or a compilation guest's preview for the studio track", async () => {
    mocks.albums.mockResolvedValue([{ id: "album", artistId: "band", artist: { name: "Band" }, itunesCollectionId: "collection" }]);
    mocks.tracks.mockResolvedValue([
      { id: "studio", name: "Song", durationMs: null, artist: { name: "Band" } },
      { id: "live", name: "Song (Live)", durationMs: 999, artist: { name: "Band" } },
    ]);
    const catalog = { lookupTracks: vi.fn().mockResolvedValue([
      { trackId: "guest", artistName: "Other Band", name: "Song", previewUrl: "wrong-artist" },
      { trackId: "live-id", artistName: "Band", name: "Song - Live", previewUrl: "live-preview", durationMs: 123, appleMusicUrl: "store" },
    ]) };
    const summary = await new EnrichmentService(undefined, undefined, catalog as unknown as ItunesCatalogAdapter).enrichAlbumsFromCatalog("owner");
    expect(summary.tracksUpdated).toBe(1);
    expect(mocks.trackUpdate).toHaveBeenCalledExactlyOnceWith({ where: { id: "live" }, data: {
      durationMs: 123, previewUrl: "live-preview", itunesTrackId: "live-id", appleMusicUrl: "store", enrichedAt: expect.any(Date),
    } });
  });
});
