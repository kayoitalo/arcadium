import { describe, expect, it } from "vitest";
import { gapLabel } from "./gap";

describe("a medida entre duas audições", () => {
  it("reads like a dimension on a plan", () => {
    expect(gapLabel(0)).toBe("logo em seguida");
    expect(gapLabel(0.4)).toBe("logo em seguida");
    expect(gapLabel(8)).toBe("8 min");
    expect(gapLabel(60)).toBe("1h");
    expect(gapLabel(150)).toBe("2h30");
    expect(gapLabel(125)).toBe("2h05");
    expect(gapLabel(24 * 60 + 30)).toBe("1 dia");
    expect(gapLabel(3 * 24 * 60)).toBe("3 dias");
  });
});
