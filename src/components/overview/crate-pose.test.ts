import { describe, expect, it } from "vitest";
import { cratePose, stepFocus } from "./crate-pose";

describe("cratePose", () => {
  it("puts the focused record upright, in front of everything", () => {
    const front = cratePose(0);
    expect(front.x).toBe(0);
    expect(front.scale).toBe(1);
    expect(front.opacity).toBe(1);
    expect(Math.abs(front.rotateY)).toBeLessThan(10);
    expect(front.zIndex).toBeGreaterThan(cratePose(1).zIndex);
  });

  it("leans the stored records back, to opposite sides of the focus", () => {
    expect(cratePose(1).rotateY).toBeLessThan(-40);
    expect(cratePose(-1).rotateY).toBeGreaterThan(40);
    expect(cratePose(1).x).toBeGreaterThan(0);
    expect(cratePose(-1).x).toBeLessThan(0);
  });

  it("spreads the stack outward and fades it with depth", () => {
    expect(cratePose(3).x).toBeGreaterThan(cratePose(2).x);
    expect(cratePose(3).opacity).toBeLessThan(cratePose(2).opacity);
    expect(cratePose(3).scale).toBeLessThan(cratePose(2).scale);
    expect(cratePose(-3).x).toBeLessThan(cratePose(-2).x);
  });

  it("stops shrinking past the cap, so the back of the crate never vanishes", () => {
    expect(cratePose(40).scale).toBe(cratePose(8).scale);
    expect(cratePose(40).opacity).toBeGreaterThan(0);
  });
});

describe("stepFocus", () => {
  it("walks the crate one record at a time", () => {
    expect(stepFocus(3, 1, 12)).toBe(4);
    expect(stepFocus(3, -1, 12)).toBe(2);
  });

  it("stops at the ends instead of wrapping around", () => {
    // caixote tem começo e fim: dar a volta faria perder a noção de onde se está
    expect(stepFocus(0, -1, 12)).toBe(0);
    expect(stepFocus(11, 1, 12)).toBe(11);
  });

  it("survives an empty crate", () => {
    expect(stepFocus(0, 1, 0)).toBe(0);
  });
});
