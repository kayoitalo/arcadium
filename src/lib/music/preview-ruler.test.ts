import { describe, expect, it } from "vitest";
import { clock, progressOf, rulerMarks } from "./preview-ruler";

describe("a régua da prévia", () => {
  it("marks every five seconds of a 30 s preview, longer at 0, 15 and 30", () => {
    const marks = rulerMarks(30);
    expect(marks.map((mark) => mark.seconds)).toEqual([0, 5, 10, 15, 20, 25, 30]);
    expect(marks.filter((mark) => mark.major).map((mark) => mark.seconds)).toEqual([0, 15, 30]);
    expect(marks[0].at).toBe(0);
    expect(marks[6].at).toBe(1);
  });

  it("keeps the marks inside a preview that is a little shorter than 30 s", () => {
    const marks = rulerMarks(29.8);
    expect(marks).toHaveLength(7);
    expect(marks.every((mark) => mark.at >= 0 && mark.at <= 1)).toBe(true);
  });

  it("draws nothing before the duration is known", () => {
    expect(rulerMarks(Number.NaN)).toEqual([]);
    expect(rulerMarks(0)).toEqual([]);
    expect(rulerMarks(Number.POSITIVE_INFINITY)).toEqual([]);
  });

  it("tells the time like a player and never leaves the ruler", () => {
    expect(clock(12.9)).toBe("0:12");
    expect(clock(75)).toBe("1:15");
    expect(clock(Number.NaN)).toBe("0:00");
    expect(progressOf(15, 30)).toBe(0.5);
    expect(progressOf(40, 30)).toBe(1);
    expect(progressOf(-1, 30)).toBe(0);
    expect(progressOf(3, Number.NaN)).toBe(0);
  });
});
