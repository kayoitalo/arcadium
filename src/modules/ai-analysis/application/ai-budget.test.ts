import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const counts = { day: 0, hour: 0 };

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    aIAnalysisRun: {
      count: vi.fn(async ({ where }: { where: { createdAt: { gte: Date } } }) => {
        const spanHours = (Date.now() - where.createdAt.gte.getTime()) / 3_600_000;
        return spanHours > 2 ? counts.day : counts.hour;
      }),
    },
  },
}));

describe("readBudget", () => {
  beforeEach(() => {
    counts.day = 0;
    counts.hour = 0;
    vi.resetModules();
  });

  afterEach(() => {
    delete process.env.AI_DAILY_LIMIT;
    delete process.env.AI_HOURLY_LIMIT;
  });

  async function load() {
    return (await import("./ai-budget")).readBudget("user-1");
  }

  it("libera quando está longe dos dois tetos", async () => {
    counts.day = 2;
    counts.hour = 1;
    const budget = await load();
    expect(budget.allowed).toBe(true);
    expect(budget.blockedBy).toBeUndefined();
  });

  it("barra pela hora antes de barrar pelo dia", async () => {
    counts.day = 5;
    counts.hour = 3;
    const budget = await load();
    expect(budget.allowed).toBe(false);
    expect(budget.blockedBy).toBe("hour");
  });

  it("barra pelo dia quando a hora ainda tem folga", async () => {
    counts.day = 12;
    counts.hour = 0;
    const budget = await load();
    expect(budget.allowed).toBe(false);
    expect(budget.blockedBy).toBe("day");
  });

  it("deixa o limite exato passar a barrar, não o anterior", async () => {
    counts.day = 11;
    counts.hour = 0;
    expect((await load()).allowed).toBe(true);

    counts.day = 12;
    expect((await load()).allowed).toBe(false);
  });

  it("reporta o consumo para a interface poder mostrar", async () => {
    counts.day = 4;
    counts.hour = 2;
    const budget = await load();
    expect(budget).toMatchObject({ usedToday: 4, usedThisHour: 2, dailyLimit: 12, hourlyLimit: 3 });
  });
});
