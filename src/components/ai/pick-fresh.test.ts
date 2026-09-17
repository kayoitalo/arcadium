import { describe, expect, it } from "vitest";
import { pickFresh } from "./pick-fresh";

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value) };
};

describe("pickFresh", () => {
  const readings = ["WAKE ME UP INSIDE?", "O caranguejo abriu a antena!", "Dos robôs direto pro grunge!"];

  it("never shows the same item twice in a row", () => {
    const storage = memory();
    let previous: string | null = null;
    for (let draw = 0; draw < 30; draw += 1) {
      const choice = pickFresh(readings, "gy:reading:30d", (item) => item, { storage, random: () => (draw % 7) / 7 });
      expect(choice).not.toBe(previous);
      previous = choice;
    }
  });

  it("keeps each key's memory apart and works with a single item or none", () => {
    const storage = memory();
    pickFresh(readings, "gy:reading:7d", (item) => item, { storage, random: () => 0 });
    expect(pickFresh(readings, "gy:reading:1y", (item) => item, { storage, random: () => 0 })).toBe(readings[0]);
    expect(pickFresh(["só uma"], "gy:x", (item) => item, { storage })).toBe("só uma");
    expect(pickFresh([], "gy:x", (item: string) => item, { storage })).toBeNull();
  });

  it("still picks when storage is unavailable", () => {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readings).toContain(pickFresh(readings, "gy:x", (item) => item, { storage: broken }));
  });
});
