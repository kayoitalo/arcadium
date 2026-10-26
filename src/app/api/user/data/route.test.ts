import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(), findUser: vi.fn(), events: vi.fn(), runs: vi.fn(), connections: vi.fn(), lock: vi.fn(), transaction: vi.fn(),
}));
vi.mock("@/lib/security/api-auth", () => ({ authorizeApi: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  $transaction: mocks.transaction,
  user: { findUnique: mocks.findUser }, listeningEvent: { deleteMany: mocks.events },
  syncRun: { deleteMany: mocks.runs }, providerConnection: { deleteMany: mocks.connections },
} }));
import { DELETE, GET } from "./route";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ userId: "authenticated-owner" });
  mocks.findUser.mockResolvedValue({ id: "authenticated-owner", email: "owner@test", connections: [], listeningEvents: [] });
  mocks.events.mockResolvedValue({ count: 1 });
  mocks.lock.mockResolvedValue([]);
  mocks.transaction.mockImplementation((task) => task({
    $queryRaw: mocks.lock, listeningEvent: { deleteMany: mocks.events },
    syncRun: { deleteMany: mocks.runs }, providerConnection: { deleteMany: mocks.connections },
  }));
});

describe("personal data ownership", () => {
  it("exports only the authenticated account and prevents response caching", async () => {
    const response = await GET(new Request("https://app.test/api/user/data"));
    expect(mocks.findUser).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "authenticated-owner" } }));
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("limits history, sync-run and connection deletion to the authenticated account", async () => {
    await DELETE(new Request("https://app.test/api/user/data", { method: "DELETE" }));
    expect(mocks.events).toHaveBeenCalledWith({ where: { userId: "authenticated-owner" } });
    expect(mocks.runs).toHaveBeenCalledWith({ where: { connection: { userId: "authenticated-owner" } } });
    expect(mocks.connections).toHaveBeenCalledWith({ where: { userId: "authenticated-owner" } });
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.events.mock.invocationCallOrder[0]);
  });
  it("refuses to purge while a sync owns a connection", async () => {
    mocks.lock.mockResolvedValue([{ status: "SYNCING" }]);
    const response = await DELETE(new Request("https://app.test/api/user/data", { method: "DELETE" }));
    expect(response.status).toBe(409);
    expect(mocks.events).not.toHaveBeenCalled();
    expect(mocks.runs).not.toHaveBeenCalled();
    expect(mocks.connections).not.toHaveBeenCalled();
  });
  it("redirects an expired browser download to login but preserves API 401s", async () => {
    const blocked = new Response("unauthorized", { status: 401 });
    mocks.auth.mockResolvedValue({ response: blocked });
    const response = await GET(new Request("https://app.test/api/user/data", { headers: { "sec-fetch-mode": "navigate" } }));
    expect(response.headers.get("location")).toBe("https://app.test/login?expired=1");
    expect(await GET(new Request("https://app.test/api/user/data"))).toBe(blocked);
    expect(mocks.findUser).not.toHaveBeenCalled();
  });
});
