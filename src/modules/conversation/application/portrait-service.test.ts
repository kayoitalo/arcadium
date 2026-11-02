import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), aggregate: vi.fn(), sql: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique: mocks.user }, listeningEvent: { aggregate: mocks.aggregate }, $queryRaw: mocks.sql,
  $transaction: (queries: Promise<unknown>[], options: unknown) => { expect(options).toEqual({ isolationLevel: "RepeatableRead" }); return Promise.all(queries); },
} }));
import { PortraitService } from "./portrait-service";
describe("observed portrait", () => {
  it("binds the owner, timezone and non-overlapping windows without inferring mood or lifetime coverage", async () => {
    mocks.user.mockResolvedValue({ timezone: "invalid-zone" }); mocks.aggregate.mockResolvedValue({ _count: { id: 40 }, _min: { playedAt: null }, _max: { playedAt: null } }); mocks.sql.mockResolvedValue([]);
    const now = new Date("2026-11-02T12:00:00Z"); const data = await new PortraitService().load("owner", now);
    expect(data).toMatchObject({ total: 40, timezone: "America/Sao_Paulo", artists: [], changes: [], asOf: now.toISOString() });
    expect(mocks.aggregate).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "owner", playedAt: { lte: now } } }));
    expect(mocks.sql.mock.calls[0]).toContain("owner"); expect(mocks.sql.mock.calls[0]).toContain("America/Sao_Paulo");
    expect(mocks.sql.mock.calls[0][0].join("?")).toContain("AT TIME ZONE 'UTC'");
    expect(new Date(data.windows.currentFrom).getTime() - new Date(data.windows.previousFrom).getTime()).toBe(30 * 86400000);
  });
});
