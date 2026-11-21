import { describe, expect, it } from "vitest";
import { fillMonths } from "./artist-trail";

describe("a trilha do artista", () => {
  it("keeps the empty months between the first and the last, across years", () => {
    expect(fillMonths([{ month: "2023-02", plays: 4 }, { month: "2022-11", plays: 2 }])).toEqual([
      { month: "2022-11", plays: 2 }, { month: "2022-12", plays: 0 }, { month: "2023-01", plays: 0 }, { month: "2023-02", plays: 4 },
    ]);
    expect(fillMonths([])).toEqual([]);
  });
});
