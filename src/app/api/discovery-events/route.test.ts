import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), item: vi.fn(), previous: vi.fn(), upsert: vi.fn() }));
vi.mock("@/lib/security/api-auth", () => ({ authorizeApi: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { recommendationItem: { findFirst: mocks.item }, discoveryEvent: { findUnique: mocks.previous, upsert: mocks.upsert } } }));
import { POST } from "./route";
const request = () => new Request("https://app.test/api/discovery-events", { method: "POST", body: JSON.stringify({ itemId: "item", requestKey: "10000000-0000-4000-8000-000000000001" }) });
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ userId: "owner" }); mocks.item.mockResolvedValue({ id: "item", previewUrl: "https://example.test/preview" }); mocks.previous.mockResolvedValue(null); mocks.upsert.mockResolvedValue({ itemId: "item" }); });
describe("preview starts", () => {
  it("requires an owned item with media, and records no like/complete-listen inference", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.item).toHaveBeenCalledWith({ where: { id: "item", session: { userId: "owner" } }, select: { id: true, previewUrl: true } });
    mocks.item.mockResolvedValue(null); expect((await POST(request())).status).toBe(404);
  });
  it("detects a key collision even if a concurrent request won the unique constraint", async () => {
    mocks.upsert.mockResolvedValue({ itemId: "different" }); expect((await POST(request())).status).toBe(409);
  });
});
