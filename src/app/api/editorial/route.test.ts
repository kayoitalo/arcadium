import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), update: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/security/api-auth", () => ({ authorizeApi: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { editorialMemory: { updateMany: mocks.update, findMany: mocks.read } } }));
import { POST, GET } from "./route";
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ userId: "owner" }); mocks.update.mockResolvedValue({ count: 1 }); mocks.read.mockResolvedValue([]); });
describe("editorial choices", () => {
  it.each(["SEEN", "DISMISS", "RESTORE"])("scopes %s to a registered topic of the authenticated account", async (action) => {
    const key = "a".repeat(64); await POST(new Request("https://app.test/api/editorial", { method: "POST", body: JSON.stringify({ key, action, version: 0 }) }));
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "owner", key, ...(action === "SEEN" ? { version: 0 } : {}) } }));
    const data = mocks.update.mock.calls[0][0].data;
    expect(data).toEqual(action === "SEEN" ? { seenAt: expect.any(Date) } : action === "DISMISS" ? { dismissed: true } : { dismissed: false, seenAt: null, version: { increment: 1 } });
  });
  it("does not create arbitrary topic IDs on a client request", async () => {
    mocks.update.mockResolvedValue({ count: 0 });
    expect((await POST(new Request("https://app.test/api/editorial", { method: "POST", body: JSON.stringify({ key: "b".repeat(64), version: 0, action: "SEEN" }) }))).status).toBe(404);
    await GET(new Request("https://app.test/api/editorial")); expect(mocks.read).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "owner", dismissed: true }, take: 200 }));
  });
});
