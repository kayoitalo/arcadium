import { describe, expect, it } from "vitest";
import { tabTitle } from "./use-tab-title";

describe("o título da aba", () => {
  it("says what is playing and goes back to the house name in silence", () => {
    expect(tabTitle("Arcadium", "Cais · Milton Nascimento")).toBe("▶ Cais · Milton Nascimento · Arcadium");
    expect(tabTitle("Arcadium", null)).toBe("Arcadium");
    expect(tabTitle("Arcadium", "   ")).toBe("Arcadium");
    expect(tabTitle("Arcadium", "Duas\n linhas")).toBe("▶ Duas linhas · Arcadium");
  });
});
