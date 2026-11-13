import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), sql: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique: mocks.user }, $queryRaw: mocks.sql } }));

import { fullestDay, localDay, localDayBounds, monthGrid, type MonthDay } from "@/modules/statistics/domain/month-calendar";
import { loadMonthCovers } from "./month-covers";

const entry = (day: string, plays: number): MonthDay => ({ day, plays, album: "Disco", artist: "Artista", coverUrl: null });

describe("o mês em capas", () => {
  it("delimits a calendar day in the listener's timezone, not in UTC", () => {
    const bounds = localDayBounds("2026-11-07", "America/Sao_Paulo")!;
    expect(bounds.start.toISOString()).toBe("2026-11-07T03:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-11-08T03:00:00.000Z");
    expect(localDay(new Date("2026-11-08T02:30:00Z"), "America/Sao_Paulo")).toBe("2026-11-07");
  });

  it("keeps a day 23 or 25 hours long across a clock change", () => {
    const spring = localDayBounds("2026-03-29", "Europe/Lisbon")!;
    expect((spring.end.getTime() - spring.start.getTime()) / 3_600_000).toBe(23);
    const autumn = localDayBounds("2026-10-25", "Europe/Lisbon")!;
    expect((autumn.end.getTime() - autumn.start.getTime()) / 3_600_000).toBe(25);
  });

  it("refuses days that do not exist", () => {
    expect(localDayBounds("2026-02-30", "America/Sao_Paulo")).toBeNull();
    expect(localDayBounds("07/11/2026", "America/Sao_Paulo")).toBeNull();
    expect(localDayBounds("2026-11-07; DROP", "America/Sao_Paulo")).toBeNull();
  });

  it("lays the month out from Sunday, leaving gaps before day 1 and marking what has not happened yet", () => {
    // novembro de 2026 começa num domingo; outubro, numa quinta
    expect(monthGrid("2026-11", "2026-11-12", [])[0]).toMatchObject({ number: 1 });
    const october = monthGrid("2026-10", "2026-10-03", [entry("2026-10-02", 9)]);
    expect(october.slice(0, 4).every((cell) => cell.day === null)).toBe(true);
    expect(october[4]).toMatchObject({ number: 1, future: false, entry: null });
    expect(october[5].entry?.plays).toBe(9);
    expect(october[7].future).toBe(true);
    expect(october).toHaveLength(4 + 31);
  });

  it("picks the fullest day, the most recent one on a tie", () => {
    expect(fullestDay([])).toBeNull();
    expect(fullestDay([entry("2026-11-02", 30), entry("2026-11-07", 63), entry("2026-11-09", 63)])?.day).toBe("2026-11-09");
  });

  it("reads only the owner's current local month and falls back from an invalid timezone", async () => {
    mocks.user.mockResolvedValue({ timezone: "nowhere/invalid" });
    mocks.sql.mockResolvedValue([{ day: "2026-10-31", plays: 4, album: null, artist: null, coverUrl: null }, { day: "2026-11-01", plays: 12, album: "Disco", artist: "Artista", coverUrl: "https://coverartarchive.org/x" }]);
    const data = await loadMonthCovers("owner", new Date("2026-11-12T15:00:00Z"));
    expect(data).toMatchObject({ month: "2026-11", today: "2026-11-12", timezone: "America/Sao_Paulo" });
    expect(data.days.map((day) => day.day)).toEqual(["2026-11-01"]);
    const call = mocks.sql.mock.calls[0];
    expect(call).toContain("owner");
    expect(call).toContainEqual(new Date("2026-11-01T03:00:00.000Z"));
  });
});
