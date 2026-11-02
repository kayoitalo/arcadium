import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), summary: vi.fn() }));
vi.mock("@/lib/security/api-auth", () => ({ authorizeApi: mocks.auth }));
vi.mock("@/modules/recommendations/application/discovery-memory-service", () => ({ DiscoveryMemoryService: class { list = mocks.list; summary = mocks.summary; } }));
import { GET } from "./route";
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ userId: "owner" }); mocks.list.mockResolvedValue({ sessions: [], nextCursor: "next", limits: { sessions: 10, feedbackPerItem: 50 } }); });
describe("private discovery memory API", () => {
  it("exports a declared filtered page, not a misleading full history", async () => {
    const response = await GET(new Request("https://app.test/api/discovery-memory?q=Live&responses=1&download=1&userId=other"));
    expect(mocks.list).toHaveBeenCalledWith("owner", { q: "Live", responses: "1" });
    expect(await response.json()).toMatchObject({ scope: "filtered-page", nextCursor: "next" });
    expect(response.headers.get("cache-control")).toBe("private, no-store"); expect(response.headers.get("content-disposition")).toContain("attachment");
  });
  it("rejects overlong filters before reading data and keeps summary separate", async () => {
    expect((await GET(new Request(`https://app.test/api/discovery-memory?q=${"a".repeat(121)}`))).status).toBe(400);
    await GET(new Request("https://app.test/api/discovery-memory?summary=1"));
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.summary).toHaveBeenCalledWith("owner");
  });
});
