import { describe, expect, it } from "vitest";
import { activityByUtcDay, calculateTasteShift, createEmptyOverview, getPeriodRanges, percentChange } from "./overview-service";

describe("overview statistics", () => {
  it("builds equivalent current and previous seven-day ranges", () => {
    const reference = new Date("2026-08-13T12:00:00.000Z");
    const { current, previous } = getPeriodRanges("7d", reference);

    expect(current.start.toISOString()).toBe("2026-08-06T12:00:00.000Z");
    expect(current.end).toEqual(reference);
    expect(previous?.start.toISOString()).toBe("2026-07-30T12:00:00.000Z");
    expect(previous?.end).toEqual(current.start);
  });

  it("does not invent a percentage when the previous baseline is zero", () => {
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(15, 10)).toBe(50);
    expect(percentChange(5, 10)).toBe(-50);
  });

  it("aggregates activity by UTC calendar day", () => {
    const activity = activityByUtcDay([
      { playedAt: new Date("2026-08-12T01:00:00.000Z") },
      { playedAt: new Date("2026-08-12T23:00:00.000Z") },
      { playedAt: new Date("2026-08-13T00:00:00.000Z") },
    ]);

    expect(activity).toEqual([
      { label: "2026-08-12", plays: 2, hours: 0.1 },
      { label: "2026-08-13", plays: 1, hours: 0.1 },
    ]);
  });

  it("returns an honest and complete empty state", () => {
    const result = createEmptyOverview("30d");

    expect(result.summary.totalPlays).toBe(0);
    expect(result.topArtists).toEqual([]);
    expect(result.listeningActivity).toEqual([]);
    expect(result.recommended).toBeNull();
    expect(result.aiStory.insight).toContain("Nenhuma conclusão");
  });

  it("calculates genre shifts only from weighted artist tags", () => {
    const result = calculateTasteShift(
      [{ name: "A", plays: 30, tags: ["rock"] }, { name: "B", plays: 20, tags: ["jazz"] }],
      [{ name: "A", plays: 10, tags: ["rock"] }, { name: "B", plays: 40, tags: ["jazz"] }],
    );
    expect(result.rising).toEqual([{ genre: "rock", changePercent: 200, currentShare: 60, previousShare: 20 }]);
    expect(result.declining).toEqual([{ genre: "jazz", changePercent: -50, currentShare: 40, previousShare: 80 }]);
  });
});
