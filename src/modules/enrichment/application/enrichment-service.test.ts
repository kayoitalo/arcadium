import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  artistCount: vi.fn(), albumCount: vi.fn(), trackCount: vi.fn(),
  artists: vi.fn(), albums: vi.fn(), recent: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  artist: { count: mocks.artistCount, findMany: mocks.artists },
  album: { count: mocks.albumCount, findMany: mocks.albums },
  track: { count: mocks.trackCount }, listeningEvent: { groupBy: mocks.recent },
} }));
import { EnrichmentService } from "./enrichment-service";
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
});
