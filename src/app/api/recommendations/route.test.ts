import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), generate: vi.fn(), latest: vi.fn() }));
vi.mock("@/lib/security/api-auth", () => ({ authorizeApi: mocks.auth }));
vi.mock("@/modules/recommendations/application/recommendation-service", () => ({ RecommendationService: class {
  generateSession = mocks.generate; getLatestSession = mocks.latest;
} }));
import { GET, POST } from "./route";
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ userId: "owner" }); });
const post = (body: unknown) => POST(new Request("https://app.test/api/recommendations", { method: "POST", body: JSON.stringify(body) }));
describe("session API contract", () => {
  it("authorizes before accessing session state or generating", async () => {
    mocks.auth.mockResolvedValue({ response: NextResponse.json({}, { status: 401 }) });
    expect((await post({})).status).toBe(401); expect(mocks.generate).not.toHaveBeenCalled();
  });
  it("validates operations and binds generation to the authenticated owner", async () => {
    expect((await post({ operation: "MORE" })).status).toBe(400);
    expect((await post({ mode: "INVALID" })).status).toBe(400);
    mocks.generate.mockResolvedValue({ sessionId: "new", items: [] });
    expect((await post({ operation: "NEW_ENTRY", requestKey: crypto.randomUUID(), userId: "intruder", proximity: 150, fame: -10 })).status).toBe(200);
    expect(mocks.generate).toHaveBeenCalledWith(expect.objectContaining({ userId: "owner", operation: "NEW_ENTRY", dials: { proximity: 100, fame: 0 } }));
  });
  it("reports a missing migration as an actionable configuration response", async () => {
    mocks.latest.mockRejectedValue(Object.assign(new Error(), { code: "P2022" }));
    const response = await GET(new Request("https://app.test/api/recommendations"));
    expect(response.status).toBe(503); expect((await response.json()).code).toBe("DISCOVERY_MIGRATION_REQUIRED");
  });
});
