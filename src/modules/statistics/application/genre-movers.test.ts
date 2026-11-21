import { describe, expect, it } from "vitest";
import { pickMovers } from "./genre-movers";

const rows = [
  { album: "Da Lama ao Caos", artist: "Chico", coverUrl: "a", current: 19, previous: 0 },
  { album: "Afrociberdelia", artist: "Chico", coverUrl: null, current: 13, previous: 2 },
  { album: "Bad", artist: "Michael", coverUrl: "b", current: 1, previous: 12 },
  { album: "Thriller", artist: "Michael", coverUrl: "c", current: 4, previous: 6 },
];
const genres: Record<string, string[]> = { Chico: ["Mangue Beat"], Michael: ["pop"] };

describe("quem puxou a mudança", () => {
  it("lists the albums of the cited genre that gained the most", () => {
    expect(pickMovers(rows, (artist) => genres[artist], "mangue beat", 1).map((row) => [row.album, row.delta])).toEqual([["Da Lama ao Caos", 19], ["Afrociberdelia", 11]]);
  });

  it("lists the albums that lost the most when the genre fell, and nothing of other genres", () => {
    expect(pickMovers(rows, (artist) => genres[artist], "pop", -1).map((row) => [row.album, row.delta])).toEqual([["Bad", -11], ["Thriller", -2]]);
    expect(pickMovers(rows, (artist) => genres[artist], "rock", 1)).toEqual([]);
  });
});
