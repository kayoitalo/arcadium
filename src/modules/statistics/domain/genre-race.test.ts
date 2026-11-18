import { describe, expect, it } from "vitest";
import { biggestClimb, buildRace, lastMonths, monthShares } from "./genre-race";

const genres: Record<string, string[]> = { milton: ["mpb"], burial: ["dubstep", "electronic"], chico: ["manguebeat"], gal: ["mpb", "tropicalia"], nobody: [] };
const of = (artist: string) => genres[artist] ?? [];

describe("a pista dos gêneros", () => {
  it("splits an artist's plays across their genres and skips artists without genre", () => {
    const shares = monthShares([{ month: "2026-10", artist: "burial", plays: 10 }, { month: "2026-10", artist: "nobody", plays: 99 }], of);
    expect(Object.fromEntries(shares.get("2026-10")!)).toEqual({ dubstep: 5, electronic: 5 });
  });

  it("ranks each month and follows a genre that climbs", () => {
    const rows = [
      { month: "2026-09", artist: "milton", plays: 50 }, { month: "2026-09", artist: "burial", plays: 40 }, { month: "2026-09", artist: "chico", plays: 2 },
      { month: "2026-10", artist: "milton", plays: 50 }, { month: "2026-10", artist: "chico", plays: 45 }, { month: "2026-10", artist: "burial", plays: 10 },
    ];
    const race = buildRace(["2026-08", "2026-09", "2026-10"], monthShares(rows, of));
    expect(race.months).toEqual(["2026-09", "2026-10"]);
    const lane = (genre: string) => race.lanes.find((item) => item.genre === genre)!;
    expect(lane("mpb").places).toEqual([1, 1]);
    expect(lane("manguebeat").places).toEqual([4, 2]);
    expect(lane("mpb").shares[1]).toBeCloseTo(47.6, 1);
    expect(biggestClimb(race)).toMatchObject({ lane: { genre: "manguebeat" }, from: 4, to: 2 });
  });

  it("has no race with fewer than two months that know genres", () => {
    expect(buildRace(["2026-10", "2026-11"], monthShares([{ month: "2026-11", artist: "milton", plays: 3 }], of))).toEqual({ months: ["2026-11"], lanes: [] });
  });

  it("keeps at most the requested lanes and ranks inside them", () => {
    const rows = ["a", "b", "c", "d", "e"].flatMap((artist, index) => [
      { month: "2026-10", artist, plays: 10 + index }, { month: "2026-11", artist, plays: 20 - index },
    ]);
    const race = buildRace(["2026-10", "2026-11"], monthShares(rows, (artist) => [artist]), 3);
    expect(race.lanes).toHaveLength(3);
    for (const lane of race.lanes) for (const place of lane.places) if (place !== null) expect(place).toBeLessThanOrEqual(3);
  });

  it("names the six months up to the current one across a year boundary", () => {
    expect(lastMonths("2026-02", 6)).toEqual(["2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]);
  });

  it("finds no climb when nobody moved up", () => {
    expect(biggestClimb({ months: ["a", "b"], lanes: [{ genre: "mpb", places: [1, 1], shares: [50, 50] }] })).toBeNull();
  });
});
