import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ first: vi.fn(), unique: vi.fn(), create: vi.fn(), update: vi.fn(), recent: vi.fn(), updateMany: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
  recommendationSession: { findFirst: mocks.first, findUnique: mocks.unique, create: mocks.create, update: mocks.update, updateMany: mocks.updateMany },
  recommendationItem: { findMany: mocks.recent },
} }));
import { RecommendationService } from "./recommendation-service";
import { ALGORITHM_VERSION } from "../domain/recommendation.types";
let sessions: any[];
const candidates = ["One", "Two", "Three"].map((trackName) => ({ artistName: "Band", trackName, source: "similar_artist" }));
const source = () => ({ id: "source", userId: "owner", mode: "SAFE", context: "WORKING", profilePeriod: "7d:85:70",
  algorithmVersion: ALGORITHM_VERSION, status: "ACTIVE", currentRank: 2, createdAt: new Date(), updatedAt: new Date(),
  items: candidates.map((c, index) => ({ ...c, id: String(index), rank: index + 1, status: "PENDING", feedback: [],
    exposedAt: index === 0 ? new Date() : null, reason: "original reason" })) });
beforeEach(() => {
  vi.restoreAllMocks(); vi.resetAllMocks(); sessions = [];
  mocks.first.mockImplementation(async ({ where }) => sessions.find((s) => s.userId === where.userId
    && (!where.id || s.id === where.id) && (!where.algorithmVersion || s.algorithmVersion === where.algorithmVersion)
    && (!where.status || s.status === where.status)) ?? null);
  mocks.unique.mockImplementation(async ({ where }) => sessions.find((s) => s.userId === where.userId_requestKey.userId && s.requestKey === where.userId_requestKey.requestKey) ?? null);
  mocks.create.mockImplementation(async ({ data }) => {
    if (data.requestKey && sessions.some((s) => s.userId === data.userId && s.requestKey === data.requestKey)) throw Object.assign(new Error(), { code: "P2002" });
    const row = { ...data, id: "new-" + sessions.length, items: [], createdAt: new Date(), updatedAt: new Date() };
    sessions.push(row); return row;
  });
  mocks.update.mockImplementation(async ({ where, data }) => {
    const row = sessions.find((s) => s.id === where.id);
    const items = data.items?.create?.map((c: any, index: number) => ({ ...c, id: "new-item-" + index, exposedAt: null, feedback: [] }));
    Object.assign(row, { ...data, items: items ?? row.items }); return row;
  });
  mocks.recent.mockResolvedValue([]);
});
function service() {
  const service = new RecommendationService();
  vi.spyOn(service as any, "buildUserProfile").mockResolvedValue({ topArtistNames: [], topGenres: [], knownArtistNames: new Set(),
    knownTrackKeys: new Set(), feedbackMap: new Map(), totalPlays: 0, uniqueArtists: 0 });
  vi.spyOn(service as any, "generateCandidates").mockResolvedValue(candidates);
  vi.spyOn(service as any, "resolveCovers").mockResolvedValue(new Map());
  vi.spyOn(service as any, "resolvePreviews").mockResolvedValue(new Map());
  return service;
}
describe("explicit session operations", () => {
  it("resumes beyond six hours without any candidate, cover, or preview calls", async () => {
    const old = source(); old.createdAt = new Date("2020-01-01"); sessions.push(old);
    const svc = service();
    const result = await svc.generateSession({ userId: "owner", mode: "BALANCED", operation: "RESUME", sessionId: "source" });
    expect(result.currentRank).toBe(2); expect(result.items[0].reason).toBe("original reason");
    expect((svc as any).generateCandidates).not.toHaveBeenCalled(); expect(mocks.create).not.toHaveBeenCalled();
    expect((svc as any).resolvePreviews).not.toHaveBeenCalled();
  });
  it("MORE creates another session with the original entry and avoids only presented source items", async () => {
    sessions.push(source()); const svc = service();
    const result = await svc.generateSession({ userId: "owner", mode: "EXPERIMENTAL", dials: { proximity: 0, fame: 0 },
      operation: "MORE", sessionId: "source", requestKey: "more" });
    expect(result.sessionId).not.toBe("source"); expect(result.mode).toBe("SAFE");
    expect(result.settings.dials).toEqual({ proximity: 85, fame: 70 });
    expect(result.items.map((item) => item.trackName)).not.toContain("One");
    expect(result.items).toHaveLength(1); expect(["Two", "Three"]).toContain(result.items[0].trackName);
    expect(sessions[0].currentRank).toBe(2); expect(sessions[0].items[0].reason).toBe("original reason");
  });
  it("retries a generated request without another reservation or external generation", async () => {
    const svc = service(); const input = { userId: "owner", mode: "BALANCED" as const, operation: "NEW_ENTRY" as const, requestKey: "one" };
    const first = await svc.generateSession(input); const replay = await svc.generateSession(input);
    expect(replay.sessionId).toBe(first.sessionId); expect(mocks.create).toHaveBeenCalledOnce();
    expect((svc as any).generateCandidates).toHaveBeenCalledOnce();
    await expect(svc.generateSession({ ...input, mode: "SAFE" })).rejects.toMatchObject({ status: 409 });
  });
  it("serializes concurrent retries through the unique operation key", async () => {
    const svc = service(); const input = { userId: "owner", mode: "BALANCED" as const, operation: "NEW_ENTRY" as const, requestKey: "same" };
    const results = await Promise.allSettled([svc.generateSession(input), svc.generateSession(input)]);
    expect(sessions).toHaveLength(1); expect((svc as any).generateCandidates).toHaveBeenCalledOnce();
    expect(results.some((result) => result.status === "fulfilled")).toBe(true);
  });
  it("refuses another owner's source and does not reuse a previous algorithm as a new search", async () => {
    const old = source(); old.algorithmVersion = "v2-dials"; sessions.push(old); const svc = service();
    await expect(svc.generateSession({ userId: "other", mode: "SAFE", operation: "RESUME", sessionId: "source" })).rejects.toMatchObject({ status: 404 });
    await expect(svc.generateSession({ userId: "owner", mode: "SAFE", operation: "MORE", sessionId: "source" })).rejects.toMatchObject({ status: 409 });
    const fresh = await svc.generateSession({ userId: "owner", mode: "SAFE", operation: "NEW_ENTRY", requestKey: "fresh" });
    expect(fresh.algorithmVersion).toBe(ALGORITHM_VERSION);
  });
  it("keeps failed reservations separate and never silently restarts the old session", async () => {
    sessions.push(source()); const svc = service();
    (svc as any).generateCandidates.mockRejectedValue(new Error("source unavailable"));
    const input = { userId: "owner", mode: "SAFE" as const, operation: "MORE" as const, sessionId: "source", requestKey: "failed" };
    await expect(svc.generateSession(input)).rejects.toThrow("source unavailable");
    expect(sessions[1].status).toBe("FAILED"); expect(sessions[0].status).toBe("ACTIVE");
    await expect(svc.generateSession(input)).rejects.toMatchObject({ code: "GENERATION_FAILED" });
  });
  it("does not branch from or resume an unfinished reservation as an active session", async () => {
    const pending = source(); pending.status = "GENERATING"; sessions.push(pending);
    const svc = service();
    for (const operation of ["RESUME", "MORE"] as const) await expect(svc.generateSession({
      userId: "owner", mode: "SAFE", operation, sessionId: "source",
    })).rejects.toMatchObject({ status: 409 });
    expect((svc as any).generateCandidates).not.toHaveBeenCalled();
  });
});
