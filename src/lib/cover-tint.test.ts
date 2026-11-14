import { describe, expect, it } from "vitest";
import { inkOn, tintFromPixels } from "./cover-tint";

const pixels = (...colors: Array<[number, number, number, number?]>) =>
  colors.flatMap(([r, g, b, a = 255]) => [r, g, b, a]);
const channels = (tint: string) => tint.split(" ").map(Number);

describe("tintFromPixels", () => {
  it("has no colour without opaque pixels", () => {
    expect(tintFromPixels([])).toBeNull();
    expect(tintFromPixels(pixels([200, 30, 30, 0]))).toBeNull();
  });

  it("lets the colourful part of a cover outweigh a black background", () => {
    const tint = tintFromPixels(pixels(...Array.from({ length: 9 }, () => [0, 0, 0] as [number, number, number]), [220, 40, 30]));
    const [r, g, b] = channels(tint!);
    expect(r).toBeGreaterThan(g + 40);
    expect(r).toBeGreaterThan(b + 40);
  });

  it("brings very dark and very bright covers into a band that shows on dark paper", () => {
    for (const colour of [[4, 6, 30], [250, 250, 235], [255, 0, 0]] as Array<[number, number, number]>) {
      const [r, g, b] = channels(tintFromPixels(pixels(colour))!);
      const lightness = (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
      expect(lightness).toBeGreaterThanOrEqual(0.49);
      expect(lightness).toBeLessThanOrEqual(0.67);
    }
  });

  it("keeps a grey cover grey", () => {
    const [r, g, b] = channels(tintFromPixels(pixels([90, 90, 90], [120, 120, 120]))!);
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(2);
  });
});

describe("inkOn", () => {
  it("picks dark ink for light spines and light ink for dark ones", () => {
    expect(inkOn("217 164 65")).toBe("dark");
    expect(inkOn("63 111 181")).toBe("light");
  });
});
