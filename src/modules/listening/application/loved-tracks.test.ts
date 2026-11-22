import { describe, expect, it } from "vitest";
import { readLovedTracks, rotateByDay } from "./loved-tracks";
import { representativeTracks } from "@/modules/recommendations/domain/taste-profile";
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

describe("rotateByDay", () => {
  const loved = Array.from({ length: 30 }, (_, index) => ({ artistName: `A${index}`, trackName: `T${index}` }));
  it("keeps only the recent loves and starts somewhere new each day", () => {
    const today = rotateByDay(loved, new Date("2026-11-21T12:00:00Z"));
    const tomorrow = rotateByDay(loved, new Date("2026-11-22T12:00:00Z"));
    expect(today).toHaveLength(20);
    expect(new Set(today.map((track) => track.artistName))).toEqual(new Set(loved.slice(0, 20).map((track) => track.artistName)));
    expect(tomorrow[0]).not.toEqual(today[0]);
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
