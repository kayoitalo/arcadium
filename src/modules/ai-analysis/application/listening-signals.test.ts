import { describe, expect, it } from "vitest";
import type { MusicProfileInput } from "../domain/ai-analysis.types";
import {
  availableAngles,
  describeGap,
  findComebacks,
  findOutliers,
  findUnlikelyTransition,
  longestLoop,
  pickAngle,
  pickForm,
  topTrackByArtist,
} from "./listening-signals";

describe("findOutliers", () => {
  const dominant = ["punk rock", "french house", "hip hop"];

  it("flags an artist whose genre shares nothing with the dominant ones", () => {
    const outliers = findOutliers(
      [
        { name: "Calcinha Preta", plays: 3, genres: ["forró"] },
        { name: "Green Day", plays: 9, genres: ["pop punk"] },
        { name: "Justice", plays: 4, genres: ["electro house"] },
      ],
      dominant,
    );

    expect(outliers).toEqual([{ name: "Calcinha Preta", plays: 3, genre: "forró" }]);
  });

  it("ignores single plays, artists without genre and the top artists themselves", () => {
    expect(
      findOutliers(
        [
          { name: "Uma Vez Só", plays: 1, genres: ["sertanejo"] },
          { name: "Sem Gênero", plays: 8, genres: [] },
          { name: "Do Topo", plays: 40, genres: ["k-pop"] },
        ],
        dominant,
        { exclude: new Set(["Do Topo"]) },
      ),
    ).toEqual([]);
  });

  it("finds nothing when the period has no dominant genre to contrast with", () => {
    expect(findOutliers([{ name: "Calcinha Preta", plays: 3, genres: ["forró"] }], [])).toEqual([]);
  });
});

describe("longestLoop", () => {
  const play = (track: string) => ({ artist: "Daft Punk", track });

  it("returns the longest run of the same track in a row", () => {
    const events = [play("One More Time"), ...Array(5).fill(play("Digital Love")), play("Aerodynamic"), ...Array(4).fill(play("Veridis Quo"))];
    expect(longestLoop(events)).toEqual({ artist: "Daft Punk", track: "Digital Love", times: 5 });
  });

  it("does not call a short repeat a loop, and breaks runs on unknown plays", () => {
    expect(longestLoop([play("Around the World"), play("Around the World"), play("Around the World")])).toBeNull();
    expect(longestLoop([play("Harder"), play("Harder"), { artist: null, track: null }, play("Harder"), play("Harder")])).toBeNull();
  });
});

describe("findComebacks", () => {
  const start = new Date("2026-09-01T00:00:00Z");

  it("keeps artists last heard long before the period, most played first", () => {
    const lastSeen = new Map([
      ["Avril Lavigne", new Date("2025-12-01T00:00:00Z")],
      ["Linkin Park", new Date("2026-08-20T00:00:00Z")],
      ["Kiss", new Date("2024-01-10T00:00:00Z")],
    ]);

    const comebacks = findComebacks(
      [
        { name: "Avril Lavigne", plays: 6 },
        { name: "Linkin Park", plays: 12 },
        { name: "Kiss", plays: 9 },
        { name: "Estreante", plays: 4 },
      ],
      lastSeen,
      start,
    );

    expect(comebacks).toEqual([
      { name: "Kiss", plays: 9, awayFor: "mais de 2 anos" },
      { name: "Avril Lavigne", plays: 6, awayFor: "9 meses" },
    ]);
  });
});

describe("findUnlikelyTransition", () => {
  const genres = new Map([
    ["deadmau5", ["progressive house"]],
    ["Metallica", ["thrash metal"]],
    ["Justice", ["electro house"]],
    ["Chico Science & Nação Zumbi", ["mangue beat"]],
  ]);
  const plays = new Map([["deadmau5", 40], ["Metallica", 3], ["Justice", 10], ["Chico Science & Nação Zumbi", 20]]);
  const play = (artist: string, track: string) => ({ artist, track });

  it("finds back-to-back plays of unrelated genres, preferring a frequent artist into a rare one", () => {
    const transition = findUnlikelyTransition(
      [
        play("Chico Science & Nação Zumbi", "Maracatu Atômico"),
        play("Metallica", "Master of Puppets"),
        play("deadmau5", "I Remember"),
        play("Metallica", "Master of Puppets"),
      ],
      genres,
      plays,
    );

    expect(transition).toEqual({
      from: { artist: "deadmau5", track: "I Remember", genre: "progressive house" },
      to: { artist: "Metallica", track: "Master of Puppets", genre: "thrash metal" },
    });
  });

  it("ignores neighbours that share a genre word or have no known genre", () => {
    expect(
      findUnlikelyTransition([play("deadmau5", "Strobe"), play("Justice", "D.A.N.C.E."), play("Desconhecido", "X")], genres, plays),
    ).toBeNull();
  });
});

describe("topTrackByArtist", () => {
  it("keeps each artist's most played track", () => {
    const top = topTrackByArtist([
      { artist: "Daft Punk", track: "One More Time", plays: 4 },
      { artist: "Daft Punk", track: "Harder, Better, Faster, Stronger", plays: 9 },
      { artist: "Don Toliver", track: "Body", plays: 8 },
    ]);
    expect(Object.fromEntries(top)).toEqual({ "Daft Punk": "Harder, Better, Faster, Stronger", "Don Toliver": "Body" });
  });
});

describe("describeGap", () => {
  it("speaks in months under a year and in years above", () => {
    expect(describeGap(95)).toBe("3 meses");
    expect(describeGap(274)).toBe("9 meses");
    expect(describeGap(400)).toBe("mais de um ano");
    expect(describeGap(1151)).toBe("mais de 3 anos");
  });
});

describe("angles", () => {
  const base: MusicProfileInput = {
    period: "30d",
    topArtists: [],
    topGenres: [],
    risingArtists: [],
    discovery: { newArtists: 0, newArtistPlayShare: 0 },
    concentration: { top5ArtistShare: 0, top10TrackShare: 0 },
    totalPlays: 10,
    uniqueArtists: 3,
    uniqueTracks: 5,
  };

  it("only offers angles the data can back", () => {
    expect(availableAngles(base)).toEqual(["numeros"]);
    expect(
      availableAngles({
        ...base,
        outliers: [{ name: "Calcinha Preta", plays: 3, genre: "forró" }],
        loop: { artist: "Daft Punk", track: "Digital Love", times: 5 },
      }),
    ).toEqual(["numeros", "surpresa", "loop"]);
  });

  it("avoids repeating the previous angle when there is another option", () => {
    expect(pickAngle(["numeros", "surpresa"], "surpresa", () => 0.99)).toBe("numeros");
    expect(pickAngle(["numeros"], "numeros")).toBe("numeros");
  });

  it("never draws the same joke form twice in a row", () => {
    for (let draw = 0; draw < 20; draw += 1) {
      expect(pickForm("apelido", () => draw / 20)).not.toBe("apelido");
    }
  });
});
