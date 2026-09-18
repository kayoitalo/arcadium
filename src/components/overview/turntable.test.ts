import { describe, expect, it } from "vitest";
import { armAngle } from "./turntable";

describe("armAngle", () => {
  it("rests outside the record when nothing is playing", () => {
    expect(armAngle(0, false)).toBe(42);
  });

  it("lands on the outer groove when the preview starts", () => {
    expect(armAngle(0, true)).toBe(24);
  });

  it("travels inward as the preview runs", () => {
    const start = armAngle(0, true);
    const middle = armAngle(0.5, true);
    const end = armAngle(1, true);
    expect(middle).toBeLessThan(start);
    expect(end).toBeLessThan(middle);
    expect(end).toBe(15);
  });

  it("stays where it stopped when paused mid-preview", () => {
    // pausar não devolve o braço ao descanso: o disco também mantém o ângulo
    expect(armAngle(0.4, false)).toBe(armAngle(0.4, true));
  });

  it("goes back to rest once the preview ends", () => {
    expect(armAngle(1, false)).toBe(42);
  });
});
