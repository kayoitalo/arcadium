import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ findFirst: vi.fn(), update: vi.fn(), lock: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  recommendationItem: { findFirst: db.findFirst },
  $transaction: (fn: any) => fn({ $queryRaw: db.lock, recommendationItem: db }),
} }));
import { SessionMediaService } from "./session-media-service";
beforeEach(() => vi.resetAllMocks());
const item = () => ({ id: "i", sessionId: "s", artistName: "Band", trackName: "Song", scoreComponents: { evidence: ["keep"] }, coverUrl: null });
describe("session media", () => {
  it("checks ownership before external work", async () => {
    db.findFirst.mockResolvedValue(null);
    const findPreview = vi.fn();
    await expect(new SessionMediaService({ findPreview } as any).resolve("owner", "s", "i")).rejects.toMatchObject({ status: 404 });
    expect(findPreview).not.toHaveBeenCalled();
    expect(db.findFirst).toHaveBeenCalledWith({ where: { id: "i", sessionId: "s", session: { userId: "owner" } } });
  });
  it("keeps temporary failure distinct from absence and preserves evidence on save", async () => {
    db.findFirst.mockResolvedValue(item());
    const service = new SessionMediaService({ findPreview: vi.fn().mockRejectedValue(new Error("503")) } as any,
      { findTrackCover: vi.fn().mockResolvedValue({ url: "cover" }) } as any);
    const result = await service.resolve("owner", "s", "i");
    expect(result.status).toBe("error"); expect(result.coverUrl).toBe("cover");
    expect(db.update.mock.calls[0][0].data.scoreComponents.evidence).toEqual(["keep"]);
    expect(db.update.mock.calls[0][0].data).not.toHaveProperty("rank");
    expect(db.lock).toHaveBeenCalledOnce();
  });
  it("refuses media from a different version", async () => {
    db.findFirst.mockResolvedValue(item());
    const service = new SessionMediaService({ findPreview: vi.fn().mockResolvedValue({ url: "wrong", identity: {
      source: "itunes", sourceId: "1", match: "compatible-text-v1", artistName: "Band", trackName: "Song (Live)",
    } }) } as any, { findTrackCover: vi.fn().mockResolvedValue(null) } as any);
    expect((await service.resolve("owner", "s", "i")).previewUrl).toBeNull();
  });
});
