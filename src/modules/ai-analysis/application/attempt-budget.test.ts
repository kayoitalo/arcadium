import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), lock: vi.fn(), count: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
import { reserveAttempt } from "./ai-budget";
beforeEach(() => { vi.resetAllMocks(); mocks.transaction.mockImplementation((fn) => fn({ $queryRaw: mocks.lock, aIAnalysisRun: { count: mocks.count, create: mocks.create } })); mocks.count.mockResolvedValue(0); mocks.create.mockResolvedValue({ id: "attempt" }); });
describe("physical provider budget", () => {
  it("locks the user before counting/reserving, and includes retry/fallback in the same bucket", async () => {
    await reserveAttempt("owner", "fallback");
    expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.count.mock.invocationCallOrder[0]);
    expect(mocks.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "owner", provider: { not: "gemini-pack" } }) }));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "owner", model: "fallback", kind: "ATTEMPT", status: "PENDING" }) }));
  });
  it("refuses another physical call before creating a reservation when the hourly cap is full", async () => {
    mocks.count.mockResolvedValue(3); await expect(reserveAttempt("owner", "primary")).rejects.toThrow("cota"); expect(mocks.create).not.toHaveBeenCalled();
  });
});
