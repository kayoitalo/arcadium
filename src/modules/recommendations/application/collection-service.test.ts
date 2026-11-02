import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), lock: vi.fn(), entry: vi.fn(), count: vi.fn(), upsert: vi.fn(), remove: vi.fn(), list: vi.fn(), owned: vi.fn(), batch: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction, collectionEntry: { findMany: mocks.list } } }));
import { CollectionService, collectionKey, collectFeedback } from "./collection-service";
const track = { id: "item", artistName: "Band", trackName: "Song (Live)", action: "saved" as const };
const tx = () => ({ $queryRaw: mocks.lock, collectionEntry: { findUnique: mocks.entry, count: mocks.count, upsert: mocks.upsert, deleteMany: mocks.remove, findMany: mocks.list, createMany: mocks.batch }, recommendationItem: { findMany: mocks.owned } });
beforeEach(() => {
  vi.resetAllMocks(); mocks.lock.mockResolvedValue([{ id: "owner" }]); mocks.count.mockResolvedValue(0); mocks.entry.mockResolvedValue(null);
  mocks.list.mockResolvedValue([]); mocks.owned.mockResolvedValue([track]); mocks.transaction.mockImplementation((task) => task(tx()));
});
describe("account collection", () => {
  it("keeps textual versions distinct while normalizing case/outer whitespace", () => {
    expect(collectionKey(track)).toBe(collectionKey({ artistName: " band ", trackName: " song (live) " }));
    expect(collectionKey(track)).not.toBe(collectionKey({ ...track, trackName: "Song" }));
    expect(collectionKey({ artistName: "A\u0000B", trackName: "C" })).not.toBe(collectionKey({ artistName: "A", trackName: "B\u0000C" }));
  });
  it("locks the owner and imports only owned items with unchanged track/version text", async () => {
    const result = await new CollectionService().importLocal("owner", [track, { ...track, id: "foreign" }, { ...track, trackName: "Song" }]);
    expect(result).toEqual({ imported: ["item"], importedItems: [track], skipped: ["foreign", "item"] });
    expect(mocks.owned).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ["item", "foreign", "item"] }, session: { userId: "owner" } } }));
    expect(mocks.batch).toHaveBeenCalledOnce(); expect(mocks.batch).toHaveBeenCalledWith({ data: [expect.objectContaining({ userId: "owner", sourceItemId: "item", trackName: "Song (Live)" })] });
    expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.owned.mock.invocationCallOrder[0]);
  });
  it("does not overwrite an account entry during import and preserves overflow for the browser", async () => {
    const keys = Array.from({ length: 200 }, (_, index) => ({ key: index === 0 ? collectionKey(track) : String(index) }));
    mocks.list.mockResolvedValue(keys); mocks.owned.mockResolvedValue([track, { ...track, id: "other", trackName: "Other" }]);
    const result = await new CollectionService().importLocal("owner", [track, { ...track, id: "other", trackName: "Other" }]);
    expect(result).toEqual({ imported: ["item"], importedItems: [track], skipped: ["other"] }); expect(mocks.batch).not.toHaveBeenCalled();
  });
  it("scopes read/removal to the account without touching musical feedback", async () => {
    await new CollectionService().list("owner"); await new CollectionService().remove("owner", track);
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "owner" }, take: 200 }));
    expect(mocks.remove).toHaveBeenCalledWith({ where: { userId: "owner", key: collectionKey(track) } });
  });
  it("preserves a newer selection from another source when retracting an older assessment", async () => {
    mocks.entry.mockResolvedValue({ sourceItemId: "newer-item" });
    await collectFeedback(tx() as never, "owner", track, {}, "preference", "RETRACTED");
    expect(mocks.upsert).not.toHaveBeenCalled(); expect(mocks.remove).not.toHaveBeenCalled();
  });
});
