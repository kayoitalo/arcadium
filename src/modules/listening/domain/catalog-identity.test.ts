import { describe, expect, it } from "vitest";
import { catalogMatch } from "./catalog-identity";

describe("provisional catalog grouping", () => {
  const one = { normalizedName: "ghost", mbid: "one" };
  const two = { normalizedName: "ghost", mbid: "two" };
  it("keeps known homonyms separate", () => {
    expect(catalogMatch([one, two], "Ghost", "two")).toBe(two);
    expect(catalogMatch([one], "Ghost", "two")).toBeUndefined();
    expect(catalogMatch([one, two], "Ghost")).toBeUndefined();
  });
  it("never adopts an identifier for an unresolved name", () => {
    expect(catalogMatch([{ normalizedName: "ghost", mbid: null }], "Ghost", "one")).toBeUndefined();
    expect(catalogMatch([one], "Ghost")).toBe(one);
  });
});
