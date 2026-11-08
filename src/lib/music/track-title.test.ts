import { describe, expect, it } from "vitest";
import { splitTrackTitle } from "./track-title";

describe("splitTrackTitle", () => {
  it("moves catalogue remaster suffixes out of the headline", () => {
    expect(splitTrackTitle("This Night Has Opened My Eyes - 2011 Remaster")).toEqual({ title: "This Night Has Opened My Eyes", edition: "remaster de 2011" });
    expect(splitTrackTitle("Eight Days A Week - Remastered 2009")).toEqual({ title: "Eight Days A Week", edition: "remaster de 2009" });
    expect(splitTrackTitle("Liberian Girl - 2012 Remastered Version")).toEqual({ title: "Liberian Girl", edition: "remaster de 2012" });
    expect(splitTrackTitle("Back to the Old House – Remaster")).toEqual({ title: "Back to the Old House", edition: "remasterizada" });
  });
  it("keeps versions that change the music and titles that are only the suffix", () => {
    for (const title of ["Do outro lado (Ao vivo — edição alternativa)", "Carry On", "Live - Demo", "Remaster", "- 2011 Remaster", "Remastered Dreams - Part 2"]) {
      expect(splitTrackTitle(title)).toEqual({ title, edition: null });
    }
  });
});
