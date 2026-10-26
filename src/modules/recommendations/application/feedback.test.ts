import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  transaction: vi.fn(), lock: vi.fn(), item: vi.fn(), update: vi.fn(), existing: vi.fn(), create: vi.fn(),
}));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
import { RecommendationService } from "./recommendation-service";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.item.mockResolvedValue({ id: "item", sessionId: "session", session: { userId: "owner" } });
  mocks.transaction.mockImplementation((task) => task({
    $queryRaw: mocks.lock, recommendationItem: { findUnique: mocks.item, update: mocks.update },
    recommendationFeedback: { findFirst: mocks.existing, create: mocks.create },
  }));
});
describe("feedback consistency", () => {
  it("locks the item and applies both writes within one transaction", async () => {
    await new RecommendationService().submitFeedback("owner", "item", "LIKED", undefined, "session");
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.item.mock.invocationCallOrder[0]);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "item" }, data: { status: "LIKED" } });
    expect(mocks.create).toHaveBeenCalledOnce();
  });
  it("does not duplicate or revert a decision when its committed response is retried", async () => {
    const service = new RecommendationService();
    mocks.existing.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "feedback" });
    await service.submitFeedback("owner", "item", "LIKED", undefined, "session");
    await expect(service.submitFeedback("owner", "item", "LIKED", undefined, "session")).resolves.toEqual({ success: true });
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledOnce();
  });
  it("fails the whole transaction when recording feedback fails", async () => {
    mocks.create.mockRejectedValue(new Error("database unavailable"));
    await expect(new RecommendationService().submitFeedback("owner", "item", "LIKED")).rejects.toThrow("database unavailable");
    expect(mocks.transaction).toHaveBeenCalledOnce();
  });
  it.each([["other", "session"], ["owner", "another-session"]])("refuses mismatched ownership or session: %s / %s", async (owner, session) => {
    await expect(new RecommendationService().submitFeedback(owner, "item", "LIKED", undefined, session)).rejects.toThrow("unauthorized");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
