import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), remove: vi.fn(), importLocal: vi.fn() }));
vi.mock("@/lib/security/api-auth", () => ({ authorizeApi: mocks.auth }));
vi.mock("@/modules/recommendations/application/collection-service", () => ({ CollectionService: class { list = mocks.list; remove = mocks.remove; importLocal = mocks.importLocal; } }));
import { DELETE, GET, POST } from "./route";
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ userId: "owner" }); mocks.list.mockResolvedValue([]); });
describe("private collection API", () => {
  it("uses the authenticated account, never a supplied owner, and downloads without cache", async () => {
    const response = await GET(new Request("https://app.test/api/collection?userId=other&download=1"));
    expect(mocks.list).toHaveBeenCalledWith("owner"); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toContain("attachment");
  });
  it("bounds import and rejects names without item provenance or unexpected authority fields", async () => {
    for (const body of [{ items: [{ artistName: "Band", trackName: "Song", action: "saved" }] }, { userId: "other", items: [] }, { items: Array(201).fill({ id: "one", artistName: "Band", trackName: "Song", action: "saved" }) }]) {
      const response = await POST(new Request("https://app.test/api/collection", { method: "POST", body: JSON.stringify(body) })); expect(response.status).toBe(400);
    }
    expect(mocks.importLocal).not.toHaveBeenCalled();
  });
  it("removes only the account collection choice", async () => {
    const response = await DELETE(new Request("https://app.test/api/collection", { method: "DELETE", body: JSON.stringify({ artistName: "Band", trackName: "Song (Live)" }) }));
    expect(response.status).toBe(200); expect(mocks.remove).toHaveBeenCalledWith("owner", { artistName: "Band", trackName: "Song (Live)" });
  });
});
