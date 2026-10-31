import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ groups: vi.fn(), metadata: vi.fn(), feedback: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { listeningEvent: { groupBy: mocks.groups },
  artist: { findMany: mocks.metadata }, recommendationFeedback: { findMany: mocks.feedback } } }));
import { RecommendationService } from "./recommendation-service";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.groups.mockImplementation(async ({ by, where }) => by.length === 1 ? where.playedAt
    ? [{ rawArtistName: "Recent", _count: { id: 10 } }]
    : [{ rawArtistName: "Durable", _count: { id: 90 } }, { rawArtistName: "Recent", _count: { id: 10 } }]
    : where.playedAt ? [{ rawArtistName: "Recent", rawTrackName: "New Song", _count: { id: 10 }, _max: { playedAt: new Date("2026-10-20") } }]
      : [{ rawArtistName: "Durable", rawTrackName: "Old Song", _count: { id: 90 }, _max: { playedAt: new Date("2024-01-01") } }]);
  mocks.metadata.mockResolvedValue([{ name: "Durable", tags: "rock,metal" }, { name: "Recent", tags: "jazz" }]);
  mocks.feedback.mockResolvedValue([]);
});
describe("owner-scoped hybrid profile", () => {
  it("loads distinct durable/recent counts and weights genre distributions by plays", async () => {
    const result = await (new RecommendationService() as any).buildUserProfile("owner", "30d");
    expect(result.longTerm.totalPlays).toBe(100); expect(result.recent.totalPlays).toBe(10);
    expect(result.longTerm.genres.find((entry: any) => entry.name === "jazz").share).toBe(.1);
    expect(result.recent.genres).toEqual([{ name: "jazz", share: 1 }]);
    expect(result.trackSeeds.some((seed: any) => seed.region === "long_term")).toBe(true);
    expect(result.trackSeeds.some((seed: any) => seed.region === "recent")).toBe(true);
    for (const [args] of mocks.groups.mock.calls) expect(args.where.userId).toBe("owner");
    expect(mocks.feedback).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "owner" } }));
  });
  it("does not pick arbitrary genres for homonymous catalog records", async () => {
    mocks.metadata.mockResolvedValue([{ name: "Durable", tags: "rock" }, { name: "Durable", tags: "jazz" }]);
    const result = await (new RecommendationService() as any).buildUserProfile("owner", "30d");
    expect(result.longTerm.genres).toEqual([]);
    expect(result.longTerm.genreCoverage).toBe(0);
  });
});
