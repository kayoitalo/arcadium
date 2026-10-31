import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), submit: vi.fn() }));
vi.mock("@/lib/security/api-auth", () => ({ authorizeApi: mocks.auth }));
vi.mock("@/modules/recommendations/application/recommendation-service", () => ({ RecommendationService: class { submitFeedback = mocks.submit; } }));
import { POST } from "./route";
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ userId: "owner" }); });
const post = (body: unknown) => POST(new Request("https://app.test/api/recommendations/session/feedback", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ sessionId: "session" }) });
describe("feedback API contract", () => {
  it("rejects malformed or ambiguous retractions before writing", async () => {
    for (const body of [{ itemId: "item", type: "INVALID" }, { itemId: "item", type: "RETRACTED" }, { itemId: "item", type: "LIKED", note: 42 }]) expect((await post(body)).status).toBe(400);
    expect(mocks.submit).not.toHaveBeenCalled();
  });
  it("keeps request mismatch separate and passes only explicit aspects under the authenticated owner", async () => {
    mocks.submit.mockResolvedValue({ success: true });
    await post({ userId: "other", itemId: "item", type: "REQUEST_MISMATCH", advance: true, details: { aspects: ["VOCALS", "VOCALS"] } });
    expect(mocks.submit).toHaveBeenCalledWith("owner", "item", "REQUEST_MISMATCH", undefined, "session", { advance: true, details: { aspects: ["VOCALS"] } });
  });
});
