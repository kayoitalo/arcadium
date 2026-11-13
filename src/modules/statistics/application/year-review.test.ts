import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ user: vi.fn(), sql: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { user: { findUnique: mocks.user }, $queryRaw: mocks.sql,
  $transaction: (queries: Promise<unknown>[], options: unknown) => { expect(options).toEqual({ isolationLevel: "RepeatableRead" }); return Promise.all(queries); } } }));

import { loadYearReview } from "./year-review";

describe("teu ano, medido no banco", () => {
  it("reads only the owner's current local year and picks the next newcomer when the year's top name is new too", async () => {
    mocks.user.mockResolvedValue({ timezone: "America/Sao_Paulo" });
    mocks.sql
      .mockResolvedValueOnce([{ plays: 40, artists: 3 }])
      .mockResolvedValueOnce([{ name: "Milton", plays: 22 }])
      .mockResolvedValueOnce([{ name: "Milton", plays: 22, month: 6 }, { name: "Chico", plays: 8, month: 10 }])
      .mockResolvedValueOnce([{ hour: 19, plays: 12 }])
      .mockResolvedValueOnce([{ month: 10, plays: 13 }])
      .mockResolvedValueOnce([{ name: "Clube", artist: "Milton", plays: 22, months: 4, coverUrl: null }]);
    const review = await loadYearReview("owner", new Date("2026-11-12T15:00:00Z"));
    expect(review).toMatchObject({ year: 2026, ongoing: true });
    expect(review.chapters.map((chapter) => chapter.id)).toEqual(["frase", "chegou", "hora", "mes", "disco"]);
    expect(review.chapters[1].headline).toContain("Chico");
    // o ano começa à meia-noite de 1º de janeiro no fuso de quem ouve, e vai só até agora
    for (const call of mocks.sql.mock.calls) expect(call).toContain("owner");
    expect(mocks.sql.mock.calls[0]).toContainEqual(new Date("2026-01-01T03:00:00.000Z"));
    expect(mocks.sql.mock.calls[0]).toContainEqual(new Date("2026-11-12T15:00:00Z"));
  });

  it("has no chapters for a year without plays", async () => {
    mocks.user.mockResolvedValue(null);
    mocks.sql.mockReset().mockResolvedValue([]);
    expect((await loadYearReview("owner", new Date("2026-11-12T15:00:00Z"))).chapters).toEqual([]);
  });
});
