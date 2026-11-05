import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ first: vi.fn(), unique: vi.fn(), create: vi.fn(), update: vi.fn(), recent: vi.fn(), updateMany: vi.fn(), many: vi.fn() }));
vi.mock("@/lib/db/prisma", () => { const db = {
  recommendationSession: { findFirst: mocks.first, findUnique: mocks.unique, create: mocks.create, update: mocks.update, updateMany: mocks.updateMany, findMany: mocks.many },
  recommendationItem: { findMany: mocks.recent },
}; return { prisma: { ...db, $transaction: (fn: any) => fn({ ...db, $queryRaw: async () => [{ id: "owner" }] }) } }; });
import { RecommendationService } from "./recommendation-service";
import { ALGORITHM_VERSION } from "../domain/recommendation.types";
import { TerritoryService } from "./territory-service";
import { TERRITORY_VERSION } from "../domain/territories";
let sessions: any[];
const candidates = ["One", "Two", "Three"].map((trackName) => ({ artistName: "Band", trackName, source: "similar_artist" }));
const source = () => ({ id: "source", userId: "owner", mode: "SAFE", context: "WORKING", profilePeriod: "7d:85:70",
  algorithmVersion: ALGORITHM_VERSION, status: "ACTIVE", currentRank: 2, createdAt: new Date(), updatedAt: new Date(),
  items: candidates.map((c, index) => ({ ...c, id: String(index), rank: index + 1, status: "PENDING", feedback: [],
    exposedAt: index === 0 ? new Date() : null, reason: "original reason" })) });
beforeEach(() => {
  vi.restoreAllMocks(); vi.resetAllMocks(); sessions = [];
  mocks.first.mockImplementation(async ({ where, orderBy }) => {
    const rows = sessions.filter((s) => s.userId === where.userId
    && (!where.id || s.id === where.id) && (!where.algorithmVersion || s.algorithmVersion === where.algorithmVersion)
    && (!where.status || s.status === where.status));
    if (Array.isArray(orderBy) && orderBy[0]?.lastOpenedAt) rows.sort((a, b) =>
      (b.lastOpenedAt?.getTime() ?? 0) - (a.lastOpenedAt?.getTime() ?? 0) || b.createdAt.getTime() - a.createdAt.getTime());
    return rows[0] ?? null;
  });
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
  mocks.updateMany.mockImplementation(async ({ where, data }) => {
    const row = sessions.find((s) => s.id === where.id && (!where.userId || s.userId === where.userId) && (!where.status || s.status === where.status));
    if (!row || data.lastOpenedAt && row.lastOpenedAt && row.lastOpenedAt >= data.lastOpenedAt) return { count: 0 };
    Object.assign(row, data); return { count: 1 };
  });
});
function service() {
  const service = new RecommendationService();
  vi.spyOn(service as any, "buildUserProfile").mockResolvedValue({ topArtistNames: [], topGenres: [], knownArtistNames: new Set(),
    knownTrackKeys: new Set(), feedbackMap: new Map(), totalPlays: 0, uniqueArtists: 0 });
  vi.spyOn(service as any, "generateCandidates").mockResolvedValue(candidates);
  vi.spyOn(service as any, "resolveCovers").mockResolvedValue(new Map());
  vi.spyOn(service as any, "resolvePreviews").mockResolvedValue(new Map());
  vi.spyOn(service as any, "resolveFallbackCovers").mockResolvedValue(undefined);
  return service;
}
describe("explicit session operations", () => {
  it("freezes the selected territory across MORE and replays before resolving the catalog", async () => {
    const svc = service();
    const destination = { version: TERRITORY_VERSION, genre: "dub", scope: "artist-tag" as const, capturedAt: new Date().toISOString(), artists: [] };
    const resolve = vi.spyOn(TerritoryService.prototype, "resolve").mockResolvedValue(destination);
    const generate = vi.spyOn(TerritoryService.prototype, "candidates").mockResolvedValue([{ artistName: "Other", trackName: "Door (Live)", source: "territory_catalog",
      evidence: [{ kind: "territory_tag", source: "catalog", genre: "dub", seedArtist: "Other" }] }]);
    const input = { userId: "owner", mode: "BALANCED" as const, intent: "TERRITORY" as const, operation: "NEW_ENTRY" as const, requestKey: "door", size: 6,
      territory: { version: TERRITORY_VERSION, genre: "dub" } };
    const first = await svc.generateSession(input);
    expect((await svc.generateSession(input)).sessionId).toBe(first.sessionId);
    const more = await svc.generateSession({ userId: "owner", mode: "BALANCED", operation: "MORE", sessionId: first.sessionId, requestKey: "door-more", size: 8 });
    expect(more.settings.destination).toEqual(destination); expect(more.coverage?.requested).toBe(6);
    expect(resolve).toHaveBeenCalledOnce(); expect(generate).toHaveBeenCalledTimes(2);
    expect((svc as any).generateCandidates).not.toHaveBeenCalled();
  });
  it("refuses unsupported restrictions before a reservation or provider work", async () => {
    await expect(service().generateSession({ userId: "owner", mode: "BALANCED", intent: "REPERTOIRE", operation: "NEW_ENTRY", requestKey: "unsupported", restrictions: { moment: "WORKING" } })).rejects.toMatchObject({ status: 422, code: "INSUFFICIENT_EVIDENCE" });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("requires an explicit edition instead of generating a ranked session labeled as an album", async () => {
    const svc = service();
    await expect(svc.generateSession({ userId: "owner", mode: "BALANCED", intent: "ALBUM", operation: "NEW_ENTRY", requestKey: "album" })).rejects.toMatchObject({ status: 400 });
    expect(mocks.create).not.toHaveBeenCalled(); expect((svc as any).generateCandidates).not.toHaveBeenCalled();
  });
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
  it("deepens an owned item, preserves entry settings and lineage, and replays without new provider calls", async () => {
    const original = source(); original.items[1].trackName = "Two (Live)"; sessions.push(original);
    const svc = service();
    const provider = { isConfigured: () => true, beginDiscoveryWindow: vi.fn(), getSimilarArtists: vi.fn(), getTopTracks: vi.fn(),
      getArtistReach: vi.fn().mockResolvedValue(null), getSimilarTracks: vi.fn().mockResolvedValue([
        { artistName: "Next", trackName: "Different (Live)", rank: 1 },
      ]) };
    (svc as any).similarArtists = provider;
    const input = { userId: "owner", mode: "BALANCED" as const, operation: "DEEPEN" as const, sessionId: "source", sourceItemId: "1", requestKey: "branch" };
    const result = await svc.generateSession(input);
    expect(provider.getSimilarTracks).toHaveBeenCalledExactlyOnceWith("Band", "Two (Live)", 12);
    expect(result.settings).toMatchObject({ period: "7d", mode: "SAFE", context: "WORKING", intent: "DISCOVER", dials: { proximity: 85, fame: 70 } });
    expect(result.journey).toMatchObject({ rootSessionId: "source", parentSessionId: "source", anchor: { sourceItemId: "1", trackName: "Two (Live)" } });
    expect(original.currentRank).toBe(2); expect(original.items[1].feedback).toEqual([]);
    expect((await svc.generateSession(input)).sessionId).toBe(result.sessionId);
    expect(provider.getSimilarTracks).toHaveBeenCalledOnce();
    await expect(svc.generateSession({ ...input, sourceItemId: "2" })).rejects.toMatchObject({ status: 409 });
    const more = await svc.generateSession({ userId: "owner", mode: "BALANCED", operation: "MORE", sessionId: result.sessionId, requestKey: "branch-more" });
    expect(more.journey).toMatchObject({ rootSessionId: "source", parentSessionId: result.sessionId, anchor: { sourceItemId: "1" } });
    expect(more.settings.intent).toBe("DISCOVER");
    const entry = await svc.generateSession({ userId: "owner", mode: "SAFE", operation: "NEW_ENTRY", sessionId: result.sessionId, requestKey: "reset", intent: "CONNECTIONS" });
    expect(entry.journey?.rootSessionId).toBe(entry.sessionId);
    expect(entry.journey?.anchor).toBeUndefined();
  });
  it("checks source ownership, source status and item membership before any focused lookup", async () => {
    sessions.push(source()); const svc = service();
    const input = { userId: "owner", mode: "SAFE" as const, operation: "DEEPEN" as const, sessionId: "source", sourceItemId: "1", requestKey: "focus" };
    await expect(svc.generateSession({ ...input, userId: "other" })).rejects.toMatchObject({ status: 404 });
    await expect(svc.generateSession({ ...input, sourceItemId: "another-session-item" })).rejects.toMatchObject({ status: 404 });
    sessions[0].status = "GENERATING";
    await expect(svc.generateSession(input)).rejects.toMatchObject({ status: 409 });
    expect(mocks.create).not.toHaveBeenCalled(); expect((svc as any).generateCandidates).not.toHaveBeenCalled();
  });
  it("selects known repertoire without external generation and preserves the intent on MORE", async () => {
    const svc = service();
    (svc as any).buildUserProfile.mockResolvedValue({ topArtistNames: [], topGenres: [], knownArtistNames: new Set(["band"]),
      knownTrackKeys: new Set(["band|favorite (live)"]), feedbackMap: new Map(), totalPlays: 2, uniqueArtists: 1,
      longTerm: { artists: [], genres: [], genreCoverage: 0, totalPlays: 2, tracks: [{ artistName: "Band", trackName: "Favorite (Live)", plays: 2, region: "long_term" }] } });
    const result = await svc.generateSession({ userId: "owner", mode: "BALANCED", operation: "NEW_ENTRY", intent: "REPERTOIRE", requestKey: "repertoire" });
    expect(result.items.map((item) => item.trackName)).toEqual(["Favorite (Live)"]);
    expect(result.items[0].reason).toContain("2 reproduções registradas");
    expect((svc as any).generateCandidates).not.toHaveBeenCalled();
    const more = await svc.generateSession({ userId: "owner", mode: "BALANCED", operation: "MORE", sessionId: result.sessionId, requestKey: "repertoire-more", intent: "DISCOVER" });
    expect(more.settings.intent).toBe("REPERTOIRE");
  });
  it("lists only the owner's recent active sessions and leaves legacy intentions unspecified", async () => {
    const row = { ...source(), _count: { items: 3 } };
    mocks.many.mockResolvedValue([row]);
    const result = await service().getRecentSessions("owner");
    expect(mocks.many).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "owner", status: "ACTIVE" }, take: 20 }));
    expect(result[0]).toMatchObject({ sessionId: "source", intent: null, journey: null, currentRank: 2, total: 3 });
    expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.update).not.toHaveBeenCalled();
  });
  it("remembers an explicitly resumed older path across page bootstrap without changing progress", async () => {
    const older = { ...source(), createdAt: new Date("2020-01-01"), lastOpenedAt: null };
    const newer = { ...source(), id: "newer", createdAt: new Date("2021-01-01"), lastOpenedAt: new Date("2021-01-01") };
    sessions.push(older, newer); const svc = service();
    expect((await svc.getLatestSession("owner"))?.sessionId).toBe("newer");
    await svc.generateSession({ userId: "owner", mode: "SAFE", operation: "RESUME", sessionId: "source" });
    expect((await svc.getLatestSession("owner"))?.sessionId).toBe("source");
    expect(older.currentRank).toBe(2); expect(older.createdAt).toEqual(new Date("2020-01-01"));
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "owner", status: "ACTIVE" }), data: { lastOpenedAt: expect.any(Date) } }));
    expect((svc as any).generateCandidates).not.toHaveBeenCalled();
  });
});
