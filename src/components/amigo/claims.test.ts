import { describe, expect, it } from "vitest";
import { claimPieces } from "./fala";

describe("os trechos que a prova sustenta", () => {
  it("cuts the sentence at each cited piece, once, keeping the original casing", () => {
    const used = new Set<string>();
    const pieces = claimPieces("Mais de 37% foi nos Anos 2010, e os anos 2010 dominaram.", [{ id: "d", text: "anos 2010" }], used);
    expect(pieces).toEqual(["Mais de 37% foi nos ", { id: "d", text: "Anos 2010" }, ", e os anos 2010 dominaram."]);
    expect(claimPieces("de novo os anos 2010", [{ id: "d", text: "anos 2010" }], used)).toEqual(["de novo os anos 2010"]);
  });

  it("skips overlapping and missing pieces", () => {
    const pieces = claimPieces("Smooth Criminal do Michael", [
      { id: "a", text: "Smooth Criminal" },
      { id: "b", text: "Criminal do" },
      { id: "c", text: "2Pac" },
    ], new Set());
    expect(pieces).toEqual([{ id: "a", text: "Smooth Criminal" }, " do Michael"]);
  });
});
