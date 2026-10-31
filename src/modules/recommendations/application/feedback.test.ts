import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ transaction: vi.fn(), lock: vi.fn(), item: vi.fn(), update: vi.fn(),
  history: vi.fn(), create: vi.fn(), sessionUpdate: vi.fn(), owned: vi.fn(), expose: vi.fn(), session: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { $transaction: mocks.transaction,
  recommendationItem: { findFirst: mocks.owned, updateMany: mocks.expose } } }));
import { RecommendationService } from "./recommendation-service";
import { SessionMemoryService } from "./session-memory-service";
import { effectiveFeedback } from "../domain/feedback";
let history: any[];
const preview = { source: "itunes", sourceId: "123", match: "compatible-text-v1", artistName: "Band", trackName: "Song (Live)" };
beforeEach(() => {
  vi.resetAllMocks(); history = [];
  mocks.item.mockResolvedValue({ id: "item", rank: 1, sessionId: "session", artistName: "Band", trackName: "Song (Live)", trackId: null,
    scoreComponents: { previewIdentity: preview }, session: { userId: "owner", currentRank: 1 } });
  mocks.history.mockImplementation(async () => [...history]);
  mocks.create.mockImplementation(async ({ data }) => { const row = { ...data, id: "feedback-" + (history.length + 1), createdAt: new Date() }; history.push(row); return row; });
  mocks.transaction.mockImplementation((task) => task({ $queryRaw: mocks.lock,
    recommendationItem: { findUnique: mocks.item, update: mocks.update, findFirst: mocks.owned, updateMany: mocks.expose },
    recommendationSession: { update: mocks.sessionUpdate, findFirst: mocks.session },
    recommendationFeedback: { findMany: mocks.history, create: mocks.create } }));
});
const submit = (type: any, options: any = {}) => new RecommendationService().submitFeedback("owner", "item", type, undefined, "session", options);
describe("append-only scoped feedback", () => {
  it("serializes the session, snapshots the recording and advances within the same transaction", async () => {
    await submit("LIKED", { advance: true, requestKey: "one", details: { aspects: ["VOCALS"] } });
    expect(mocks.lock.mock.invocationCallOrder[0]).toBeLessThan(mocks.item.mock.invocationCallOrder[0]);
    expect(history[0]).toMatchObject({ type: "LIKED", revision: 1, channel: "preference", details: { aspects: ["VOCALS"] },
      entity: { kind: "track", artistName: "Band", trackName: "Song (Live)", preview } });
    expect(mocks.sessionUpdate).toHaveBeenCalledWith({ where: { id: "session" }, data: { currentRank: 2 } });
  });
  it("retries an old operation without reverting later decisions or advancing twice", async () => {
    await submit("LIKED", { requestKey: "one", advance: true });
    await submit("DISLIKED", { requestKey: "two" });
    const result = await submit("LIKED", { requestKey: "one", advance: true });
    expect(history).toHaveLength(2);
    expect(result.states.preference?.type).toBe("DISLIKED");
    expect(mocks.sessionUpdate).toHaveBeenCalledOnce();
  });
  it("can like, dislike and like again, preserving the old records and explicit saves", async () => {
    await submit("LIKED"); await submit("SAVE_FOR_LATER"); await submit("DISLIKED"); await submit("LIKED");
    expect(history.map((row) => row.type)).toEqual(["LIKED", "SAVE_FOR_LATER", "DISLIKED", "LIKED"]);
    const current = effectiveFeedback(history);
    expect(current.preference?.revision).toBe(4);
    expect(current.collection?.type).toBe("SAVE_FOR_LATER");
  });
  it("withdraws a specific channel without removing unrelated signals", async () => {
    await submit("DISLIKED"); await submit("CURIOUS");
    await submit("RETRACTED", { revisesId: history[0].id });
    expect(effectiveFeedback(history).preference?.type).toBe("RETRACTED");
    expect(effectiveFeedback(history).curiosity?.type).toBe("CURIOUS");
    expect(history[0].type).toBe("DISLIKED");
  });
  it("refuses a stale revision and reuse of an operation key for another response", async () => {
    await submit("LIKED", { requestKey: "one" }); await submit("DISLIKED");
    await expect(submit("LIKED", { revisesId: history[0].id })).rejects.toMatchObject({ status: 409 });
    await expect(submit("CURIOUS", { requestKey: "one" })).rejects.toMatchObject({ status: 409 });
    expect(history).toHaveLength(2);
  });
  it("does not update status/progress after feedback creation fails", async () => {
    mocks.create.mockRejectedValue(new Error("database unavailable"));
    await expect(submit("LIKED", { advance: true })).rejects.toThrow("database unavailable");
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.sessionUpdate).not.toHaveBeenCalled();
  });
  it.each([["other", "session"], ["owner", "another-session"]])("refuses mismatched ownership/session %s / %s", async (owner, session) => {
    await expect(new RecommendationService().submitFeedback(owner, "item", "LIKED", undefined, session)).rejects.toMatchObject({ status: 404 });
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
describe("session progress", () => {
  it("marks exposure only after an owned visible-item request, not when a session is generated", async () => {
    mocks.owned.mockResolvedValue({ id: "item" });
    await new SessionMemoryService().expose("owner", "session", "item");
    expect(mocks.owned).toHaveBeenCalledWith({ where: { id: "item", sessionId: "session", session: { userId: "owner" } }, select: { id: true } });
    expect(mocks.expose).toHaveBeenCalledWith({ where: { id: "item", exposedAt: null }, data: { exposedAt: expect.any(Date) } });
  });
  it("rejects another owner's exposure and stale cursor movement", async () => {
    mocks.owned.mockResolvedValue(null);
    await expect(new SessionMemoryService().expose("other", "session", "item")).rejects.toMatchObject({ status: 404 });
    mocks.session.mockResolvedValue({ id: "session", currentRank: 3, items: [{ rank: 1 }, { rank: 2 }, { rank: 3 }] });
    await expect(new SessionMemoryService().move("owner", "session", 1, 2)).rejects.toMatchObject({ status: 409 });
    expect(mocks.sessionUpdate).not.toHaveBeenCalled();
  });
});
