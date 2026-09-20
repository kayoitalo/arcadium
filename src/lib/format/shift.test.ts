import { describe, expect, it } from "vitest";
import { shiftColor, shiftMark, shiftTone } from "./shift";

describe("shiftTone", () => {
  it("separates the two poles", () => {
    expect(shiftTone(2.4)).toBe("up");
    expect(shiftTone(-2.4)).toBe("down");
  });

  it("calls it flat when the printed number rounds to zero", () => {
    // a tela mostra uma casa: 0,04pp sai como 0,0pp, e a cor não pode
    // dizer que cresceu quando o número diz que não mudou
    expect(shiftTone(0.04)).toBe("flat");
    expect(shiftTone(-0.04)).toBe("flat");
    expect(shiftTone(0)).toBe("flat");
  });

  it("keeps a change that survives rounding", () => {
    expect(shiftTone(0.05)).toBe("up");
    expect(shiftTone(-0.05)).toBe("down");
  });

  it("does not paint garbage as growth", () => {
    expect(shiftTone(Number.NaN)).toBe("flat");
    expect(shiftTone(Number.POSITIVE_INFINITY)).toBe("flat");
  });
});

describe("shiftColor e shiftMark", () => {
  it("points each tone at its own token", () => {
    expect(shiftColor("up")).toBe("var(--shift-up)");
    expect(shiftColor("flat")).toBe("var(--shift-flat)");
    expect(shiftColor("down")).toBe("var(--shift-down)");
  });

  it("gives every tone a mark that survives without color", () => {
    const marks = (["up", "flat", "down"] as const).map(shiftMark);
    expect(new Set(marks).size).toBe(3);
  });
});
