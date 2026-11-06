import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), rows: vi.fn(), pending: vi.fn(), lock: vi.fn(), transaction: vi.fn(), collectionDelete: vi.fn(), responseDelete: vi.fn(), sessionDelete: vi.fn(), weeklyDelete: vi.fn(), editorialDelete: vi.fn(), itemsUpdate: vi.fn() }));
vi.mock("@/lib/security/api-auth", () => ({ authorizeApi: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  recommendationSession: { findMany: mocks.rows }, recommendationItem: { findMany: mocks.rows }, recommendationFeedback: { findMany: mocks.rows },
  collectionEntry: { findMany: mocks.rows }, playlistExport: { findMany: mocks.rows }, editorialMemory: { findMany: mocks.rows }, discoveryEvent: { findMany: mocks.rows }, $transaction: mocks.transaction,
  weeklyJourney: { findMany: mocks.rows }, weeklyJourneyEntry: { findMany: mocks.rows },
} }));
import { DELETE, GET } from "./route";
beforeEach(() => {
  vi.resetAllMocks(); mocks.auth.mockResolvedValue({ userId: "owner" }); mocks.rows.mockResolvedValue([]); mocks.lock.mockResolvedValue([]);
  mocks.pending.mockResolvedValue(null);
  mocks.transaction.mockImplementation((task) => task({ $queryRaw: mocks.lock, collectionEntry: { deleteMany: mocks.collectionDelete }, recommendationFeedback: { deleteMany: mocks.responseDelete }, recommendationSession: { deleteMany: mocks.sessionDelete, findFirst: mocks.pending }, weeklyJourney: { deleteMany: mocks.weeklyDelete }, editorialMemory: { deleteMany: mocks.editorialDelete }, recommendationItem: { updateMany: mocks.itemsUpdate } }));
});
describe("full private discovery data", () => {
  it("rechecks reservations created between the session locks and user lock", async () => {
    mocks.pending.mockResolvedValue({ id: "newly-generating" });
    expect((await DELETE(new Request("https://app.test/api/discovery-data", { method: "DELETE", body: JSON.stringify({ scope: "DISCOVERY", confirmation: "APAGAR" }) }))).status).toBe(409);
    expect(mocks.sessionDelete).not.toHaveBeenCalled(); expect(mocks.lock).toHaveBeenCalledTimes(2);
  });
  it("exports every section with owner scope and a continuation cursor", async () => {
    for (let section = 0; section <= 8; section++) {
      const cursor = Buffer.from(JSON.stringify({ section, after: "last" })).toString("base64url");
      const response = await GET(new Request(`https://app.test/api/discovery-data?cursor=${cursor}&userId=other`));
      expect(response.status).toBe(200);
      const args = mocks.rows.mock.calls.at(-1)![0]; expect(args.take).toBe(101); expect(args.orderBy).toEqual({ id: "asc" });
      expect(section === 1 ? args.where.session.userId : section === 8 ? args.where.journey.userId : args.where.userId).toBe("owner");
    }
    mocks.rows.mockResolvedValue(Array.from({ length: 101 }, (_, i) => ({ id: `id-${i}` })));
    const data = await (await GET(new Request("https://app.test/api/discovery-data"))).json(); expect(data.records).toHaveLength(100); expect(data.nextCursor).toBeTruthy();
  });
  it("requires an explicit valid scope/confirmation and refuses deletion during generation", async () => {
    expect((await DELETE(new Request("https://app.test/api/discovery-data", { method: "DELETE", body: JSON.stringify({ scope: "DISCOVERY" }) }))).status).toBe(400);
    mocks.lock.mockResolvedValue([{ status: "GENERATING" }]);
    expect((await DELETE(new Request("https://app.test/api/discovery-data", { method: "DELETE", body: JSON.stringify({ scope: "DISCOVERY", confirmation: "APAGAR" }) }))).status).toBe(409);
    expect(mocks.sessionDelete).not.toHaveBeenCalled(); expect(mocks.collectionDelete).not.toHaveBeenCalled();
  });
  it("deletes only the chosen account scope and preserves unrelated signals", async () => {
    await DELETE(new Request("https://app.test/api/discovery-data", { method: "DELETE", body: JSON.stringify({ scope: "RESPONSES", confirmation: "APAGAR" }) }));
    expect(mocks.responseDelete).toHaveBeenCalledWith({ where: { userId: "owner" } }); expect(mocks.sessionDelete).not.toHaveBeenCalled(); expect(mocks.collectionDelete).not.toHaveBeenCalled();
    expect(mocks.itemsUpdate).toHaveBeenCalledWith({ where: { session: { userId: "owner" } }, data: { status: "PENDING" } });
    expect(mocks.weeklyDelete).not.toHaveBeenCalled();
    const response = await DELETE(new Request("https://app.test/api/discovery-data", { method: "DELETE", body: JSON.stringify({ scope: "DISCOVERY", confirmation: "APAGAR" }) }));
    expect(response.status).toBe(200);
    expect(mocks.weeklyDelete).toHaveBeenCalledWith({ where: { userId: "owner" } });
  });
});
