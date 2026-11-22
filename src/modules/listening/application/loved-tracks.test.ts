import { describe, expect, it } from "vitest";
import { readLovedTracks } from "./loved-tracks";
import { declaredSeeds, representativeTracks } from "@/modules/recommendations/domain/taste-profile";
import { trackFeedbackKey } from "@/modules/recommendations/domain/feedback";

describe("readLovedTracks", () => {
  it("reads the list and skips entries without a name or artist", () => {
    const payload = { lovedtracks: { track: [
      { name: "Song A", artist: { name: "Artist A" } },
      { name: "", artist: { name: "Artist B" } },
      { name: "Song C", artist: {} },
    ] } };
    expect(readLovedTracks(payload)).toEqual([{ artistName: "Artist A", trackName: "Song A" }]);
  });
  it("accepts the single-object shape Last.fm uses for one track, and garbage", () => {
    expect(readLovedTracks({ lovedtracks: { track: { name: "Só", artist: { "#text": "Um" } } } })).toEqual([{ artistName: "Um", trackName: "Só" }]);
    expect(readLovedTracks(null)).toEqual([]);
  });
});

describe("declaredSeeds", () => {
  const list = (prefix: string, length: number) => Array.from({ length }, (_, index) => ({ artistName: `${prefix}${index}`, trackName: `T${index}` }));
  const none = () => 0;
  it("keeps only the 20 most recent of each source and starts somewhere new each day", () => {
    const loved = list("L", 30);
    const today = declaredSeeds(loved, [], none, new Date("2026-11-21T12:00:00Z"));
    const tomorrow = declaredSeeds(loved, [], none, new Date("2026-11-22T12:00:00Z"));
    expect(today).toHaveLength(20);
    expect(new Set(today.map((track) => track.artistName))).toEqual(new Set(loved.slice(0, 20).map((track) => track.artistName)));
    expect(tomorrow[0]).not.toEqual(today[0]);
  });
  it("alternates the Last.fm ♥ and the Spotify Curtidas, tagging each", () => {
    const seeds = declaredSeeds(list("L", 2), list("S", 3), none, new Date(0));
    expect(seeds.map((seed) => seed.region)).toEqual(["loved", "saved", "loved", "saved", "saved"]);
  });
  it("puts Curtidas that barely played ahead of the ones already in heavy rotation", () => {
    const saved = [{ artistName: "Muito", trackName: "Tocada" }, { artistName: "Quase", trackName: "Nunca" }];
    const seeds = declaredSeeds([], saved, (artist) => (artist === "Muito" ? 80 : 1), new Date(0));
    expect(seeds.map((seed) => seed.artistName)).toEqual(["Quase", "Muito"]);
  });
});

describe("loved tracks as seeds", () => {
  const slice = (tracks: Array<[string, string, number]>) => ({ artists: [], genres: [], totalPlays: 0,
    tracks: tracks.map(([artistName, trackName, plays]) => ({ artistName, trackName, plays, region: "long_term" as const })) });
  it("takes one of the seed slots for a loved track, after the in-app likes", () => {
    const seeds = representativeTracks(slice([["Long", "L", 50]]) as never, slice([["Recent", "R", 9]]) as never,
      [{ artistName: "Liked", trackName: "Curti" }], new Map(), 4, [{ artistName: "Loved", trackName: "Coração" }]);
    expect(seeds.map((seed) => [seed.artistName, seed.region])).toEqual([["Liked", "feedback"], ["Loved", "loved"], ["Recent", "long_term"], ["Long", "long_term"]]);
  });
  it("never seeds from a loved track the listener disliked here", () => {
    const seeds = representativeTracks(slice([]) as never, slice([]) as never, [], new Map([[trackFeedbackKey("Loved", "Coração"), "DISLIKED" as never]]), 4,
      [{ artistName: "Loved", trackName: "Coração" }]);
    expect(seeds).toEqual([]);
  });
});
