import { describe, expect, it } from "vitest";
import { normalizeText } from "../normalization";

describe("normalizeText", () => {
  it("trims whitespace and converts to lowercase", () => {
    expect(normalizeText("  Radiohead  ")).toBe("radiohead");
  });

  it("removes accents and diacritics", () => {
    expect(normalizeText("Café Tacvba")).toBe("cafe tacvba");
    expect(normalizeText("Sigur Rós")).toBe("sigur ros");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeText("The   Black   Keys")).toBe("the black keys");
  });

  it("handles empty input", () => {
    expect(normalizeText("")).toBe("");
  });
});
