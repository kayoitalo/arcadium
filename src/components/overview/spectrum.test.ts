import { describe, expect, it } from "vitest";
import { buildBuckets } from "./spectrum";

const today = new Date("2026-09-10T15:00:00Z");
const point = (label: string, plays: number) => ({ label, plays, hours: 0 });

describe("buildBuckets", () => {
  it("fills silent days with zero inside a fixed period", () => {
    const { buckets, unit } = buildBuckets([point("2026-09-08", 4), point("2026-09-10", 2)], 7, today);

    expect(unit).toBe("day");
    expect(buckets).toHaveLength(7);
    expect(buckets[0].start).toBe("2026-09-04");
    expect(buckets.map((bucket) => bucket.plays)).toEqual([0, 0, 0, 0, 4, 0, 2]);
  });

  it("groups a year into weeks without losing plays", () => {
    const { buckets, unit } = buildBuckets(
      [point("2025-09-11", 3), point("2026-03-01", 5), point("2026-09-10", 1)],
      365,
      today,
    );

    expect(unit).toBe("week");
    expect(buckets).toHaveLength(53);
    expect(buckets.reduce((sum, bucket) => sum + bucket.plays, 0)).toBe(9);
  });

  it("groups several years into calendar months from the first play", () => {
    const { buckets, unit } = buildBuckets([point("2023-01-15", 2), point("2026-09-01", 6)], null, today);

    expect(unit).toBe("month");
    expect(buckets[0].start).toBe("2023-01-15");
    expect(buckets[1].start).toBe("2023-02-01");
    expect(buckets[buckets.length - 1]).toEqual({ start: "2026-09-01", plays: 6 });
  });

  it("returns nothing when there is no activity", () => {
    expect(buildBuckets([], 30, today).buckets).toEqual([]);
  });
});
