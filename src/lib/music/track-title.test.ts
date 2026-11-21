import { describe, expect, it } from "vitest";
import { splitTrackTitle } from "./track-title";

describe("splitTrackTitle", () => {
  it("moves catalogue remaster suffixes out of the headline", () => {
    expect(splitTrackTitle("This Night Has Opened My Eyes - 2011 Remaster")).toEqual({ title: "This Night Has Opened My Eyes", edition: "remaster de 2011" });
    expect(splitTrackTitle("Eight Days A Week - Remastered 2009")).toEqual({ title: "Eight Days A Week", edition: "remaster de 2009" });
    expect(splitTrackTitle("Liberian Girl - 2012 Remastered Version")).toEqual({ title: "Liberian Girl", edition: "remaster de 2012" });
    expect(splitTrackTitle("Back to the Old House – Remaster")).toEqual({ title: "Back to the Old House", edition: "remasterizada" });
  });
  it("moves bracketed editions and catalogue suffixes out too", () => {
    expect(splitTrackTitle("Hybrid Theory (Bonus Edition)")).toEqual({ title: "Hybrid Theory", edition: "edição ampliada" });
    expect(splitTrackTitle("Californication (Deluxe Edition)")).toEqual({ title: "Californication", edition: "edição de luxo" });
    expect(splitTrackTitle("Rumours (Super Deluxe)")).toEqual({ title: "Rumours", edition: "edição de luxo" });
    expect(splitTrackTitle("Metallica (Remastered 2021)")).toEqual({ title: "Metallica", edition: "remaster de 2021" });
    expect(splitTrackTitle("Machine Head [Remastered]")).toEqual({ title: "Machine Head", edition: "remasterizada" });
    expect(splitTrackTitle("Hit 'Em Up - Single Version")).toEqual({ title: "Hit 'Em Up", edition: "versão do single" });
    expect(splitTrackTitle("Music Sounds Better With You - Radio Edit")).toEqual({ title: "Music Sounds Better With You", edition: "edição pra rádio" });
  });
  it("keeps bracketed versions that change the music", () => {
    for (const title of ["Hurt (Live)", "Teardrop (Remix Edition)", "A Beautiful Lie (Brazilian Version)", "Clocks (Acoustic Version)", "(Deluxe Edition)"]) {
      expect(splitTrackTitle(title)).toEqual({ title, edition: null });
    }
  });
  it("keeps versions that change the music and titles that are only the suffix", () => {
    for (const title of ["Do outro lado (Ao vivo — edição alternativa)", "Carry On", "Live - Demo", "Remaster", "- 2011 Remaster", "Remastered Dreams - Part 2"]) {
      expect(splitTrackTitle(title)).toEqual({ title, edition: null });
    }
  });
});
