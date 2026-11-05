import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sessions: vi.fn(), latest: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { recommendationSession: { findMany: mocks.sessions, findFirst: mocks.latest } } }));
import { DiscoveryMemoryService, decodeMemoryCursor } from "./discovery-memory-service";
const date = new Date("2026-11-01T12:00:00Z");
const session = (id: string) => ({ id, createdAt: date, currentRank: 1, discoveryContext: null, exports: [], _count: { items: 1 },
  items: [{ id: "item", artistName: "Band", trackName: "Song (Live)", reason: "Observed reference", rank: 1, exposedAt: null, events: [],
    feedback: [{ id: "f", type: "RETRACTED", channel: "preference", note: "Changed my mind", details: { aspects: ["VOCALS"] }, revisesId: "old", createdAt: date }] }] });
beforeEach(() => { vi.resetAllMocks(); mocks.sessions.mockResolvedValue([]); mocks.latest.mockResolvedValue(null); });
describe("discovery memory", () => {
  it("scopes sessions AND feedback to the owner, bounds reads and does not count a read as exposure", async () => {
    mocks.sessions.mockResolvedValue([session("one")]);
    const result = await new DiscoveryMemoryService().list("owner", { q: "Song", responses: "1" });
    expect(mocks.sessions).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "owner", status: "ACTIVE",
      AND: [{ items: { some: { OR: expect.any(Array) } } }, { items: { some: { feedback: { some: { userId: "owner" } } } } }] }), take: 6,
      select: expect.objectContaining({ items: expect.objectContaining({ take: 20, select: expect.objectContaining({ feedback: expect.objectContaining({ where: { userId: "owner" }, take: 11 }) }) }) }) }));
    expect(result.sessions[0]).toMatchObject({ intent: null, items: [{ trackName: "Song (Live)", exposedAt: null, feedback: [{ type: "RETRACTED", revisesId: "old" }] }] });
  });
  it("paginates deterministically through equal timestamps without offset or another owner's rows", async () => {
    mocks.sessions.mockResolvedValue(Array.from({ length: 6 }, (_, index) => session(String(20 - index))));
    const first = await new DiscoveryMemoryService().list("owner", { q: "", responses: "0" });
    expect(first.sessions).toHaveLength(5); expect(decodeMemoryCursor(first.nextCursor!)).toEqual({ at: date.toISOString(), id: "16" });
    await new DiscoveryMemoryService().list("owner", { q: "", responses: "0", cursor: first.nextCursor! });
    expect(mocks.sessions).toHaveBeenLastCalledWith(expect.objectContaining({ where: { userId: "owner", status: "ACTIVE", AND: [], OR: [{ createdAt: { lt: date } }, { createdAt: date, id: { lt: "16" } }] } }));
    expect(() => decodeMemoryCursor("invalid")).toThrow("inválida");
  });
  it("declares audit truncation instead of pretending the recent log is the effective preference", async () => {
    const row = session("one"); row.items[0].feedback = Array.from({ length: 11 }, (_, index) => ({ ...row.items[0].feedback[0], id: String(index) }));
    mocks.sessions.mockResolvedValue([row]);
    const result = await new DiscoveryMemoryService().list("owner", { q: "", responses: "0" });
    expect(result.sessions[0].items[0].feedback).toHaveLength(10); expect(result.sessions[0].items[0].moreFeedback).toBe(true);
    expect(result.sessions[0]).not.toHaveProperty("likedCount");
  });
  it("uses explicit last-opened order for the conversation summary and preserves an unknown legacy cursor", async () => {
    mocks.latest.mockResolvedValue({ ...session("old"), currentRank: null });
    const result = await new DiscoveryMemoryService().summary("owner");
    expect(result.latest).toMatchObject({ id: "old", currentRank: null, current: null });
    expect(mocks.latest).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "owner", status: "ACTIVE" }, orderBy: [{ lastOpenedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }] }));
  });
});
