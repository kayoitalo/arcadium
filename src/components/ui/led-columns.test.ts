import { describe, expect, it } from "vitest";
import { columnReach, SEGMENT_PX } from "./led-columns";

const SEGMENTS = 24;
const reach = (value: number, max = 100) => columnReach(value, max, SEGMENTS);

describe("columnReach", () => {
  it("lands on the LED grid, never between two segments", () => {
    const { settled, peak } = reach(50);
    expect(settled % SEGMENT_PX).toBe(0);
    expect(peak % SEGMENT_PX).toBe(0);
  });

  it("overshoots the value it settles on", () => {
    const { settled, peak } = reach(50);
    expect(peak).toBeGreaterThan(settled);
  });

  it("gives a short column somewhere to go: the excess is at least one segment", () => {
    // sem o mínimo, arredondar 14% de uma coluna de 1 segmento daria zero
    const { settled, peak } = reach(1);
    expect(peak - settled).toBeGreaterThanOrEqual(SEGMENT_PX);
  });

  it("never lets the overshoot leave the frame", () => {
    const { peak } = reach(100);
    expect(peak).toBeLessThanOrEqual(SEGMENTS * SEGMENT_PX);
  });

  it("keeps silence dark: nothing lit, nothing to overshoot", () => {
    expect(reach(0)).toEqual({ lit: 0, settled: 0, peak: 0 });
  });

  it("lights at least one segment for any real listening", () => {
    // uma audição num período de mil não pode sumir: vira coluna de 1
    expect(reach(1, 1000).lit).toBe(1);
  });
});
