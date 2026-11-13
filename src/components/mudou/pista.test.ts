import { describe, expect, it } from "vitest";
import { laneStrokes, raceHeight, RACE_VIEW } from "./pista";

describe("as raias da pista", () => {
  it("draws one continuous stroke that starts and ends on the month positions", () => {
    const [stroke, ...rest] = laneStrokes([3, 2, 1]);
    expect(rest).toHaveLength(0);
    expect(stroke[0]).toEqual({ x: RACE_VIEW.left, y: RACE_VIEW.top + 2 * RACE_VIEW.lane });
    expect(stroke[stroke.length - 1]).toEqual({ x: RACE_VIEW.width - RACE_VIEW.right, y: RACE_VIEW.top });
    // a curva só anda pra frente: raia de pista não volta no tempo
    expect(stroke.every((point, index) => index === 0 || point.x >= stroke[index - 1].x)).toBe(true);
  });

  it("breaks the lane where the genre left the race, and skips a lone month", () => {
    expect(laneStrokes([null, 4, 3, null, 2, 1])).toHaveLength(2);
    expect(laneStrokes([1, null, 2])).toHaveLength(0);
  });

  it("grows one lane at a time", () => {
    expect(raceHeight(8) - raceHeight(7)).toBe(RACE_VIEW.lane);
  });
});
