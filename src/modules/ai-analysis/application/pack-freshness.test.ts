import { describe, expect, it } from "vitest";
import type { MusicProfileInput } from "../domain/ai-analysis.types";
import { keepScanning, oldEnoughToCheck, packFingerprint, pickSlots, refreshDecision } from "./pack-freshness";

const profile = (overrides: Partial<MusicProfileInput> = {}): MusicProfileInput => ({
  period: "30d",
  topArtists: [{ name: "Daft Punk", plays: 35, share: 0.03 }],
  topGenres: [],
  risingArtists: [],
  discovery: { newArtists: 93, newArtistPlayShare: 0.1 },
  concentration: { top5ArtistShare: 0.15, top10TrackShare: 0.07 },
  totalPlays: 1093,
  uniqueArtists: 290,
  uniqueTracks: 722,
  outliers: [{ name: "Chico Science & Nação Zumbi", plays: 9, genre: "mangue beat" }],
  ...overrides,
});

describe("packFingerprint", () => {
  it("ignores counts that change on every sync", () => {
    expect(packFingerprint(profile({ totalPlays: 1200, uniqueArtists: 301 }))).toBe(packFingerprint(profile()));
  });

  it("changes when the story changes", () => {
    const withNewOutlier = profile({ outliers: [{ name: "Tribalistas", plays: 7, genre: "mpb" }] });
    expect(packFingerprint(withNewOutlier)).not.toBe(packFingerprint(profile()));
  });
});

describe("refreshDecision", () => {
  const now = new Date("2026-09-17T12:00:00Z");
  const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);

  it("generates when there is no pack or it is too old", () => {
    expect(refreshDecision(null, "abc", "30d", now)).toBe("missing");
    expect(refreshDecision({ builtAt: hoursAgo(80), fingerprint: "abc" }, "abc", "30d", now)).toBe("too_old");
  });

  it("waits for the minimum age before reacting to a changed listening", () => {
    expect(refreshDecision({ builtAt: hoursAgo(3), fingerprint: "old" }, "new", "30d", now)).toBe("too_recent");
    expect(refreshDecision({ builtAt: hoursAgo(13), fingerprint: "old" }, "new", "30d", now)).toBe("changed");
    expect(refreshDecision({ builtAt: hoursAgo(13), fingerprint: "same" }, "same", "30d", now)).toBe("fresh");
  });

  it("gives each period its own pace", () => {
    expect(refreshDecision({ builtAt: hoursAgo(25), fingerprint: "a" }, "a", "7d", now)).toBe("too_old");
    expect(refreshDecision({ builtAt: hoursAgo(25), fingerprint: "a" }, "b", "all", now)).toBe("too_recent");
    expect(oldEnoughToCheck(hoursAgo(2), "7d", now)).toBe(false);
    expect(oldEnoughToCheck(null, "7d", now)).toBe(true);
  });
});

describe("pickSlots", () => {
  it("gives every reading a different form, repeating angles only when needed", () => {
    const slots = pickSlots(["surpresa", "volta"], 4, () => 0.3);
    expect(slots).toHaveLength(4);
    expect(new Set(slots.map((slot) => slot.form)).size).toBe(4);
    expect(new Set(slots.map((slot) => slot.angle))).toEqual(new Set(["surpresa", "volta"]));
  });

  it("falls back to numbers when the profile backs no angle", () => {
    expect(pickSlots([], 2).every((slot) => slot.angle === "numeros")).toBe(true);
  });
});

describe("keepScanning", () => {
  it("ends the round after generating: one pack per run is the deal", () => {
    expect(keepScanning("generated")).toBe(false);
  });

  it("ends the round when the budget blocked it: the ceiling is the same for every period", () => {
    expect(keepScanning("blocked")).toBe(false);
  });

  it("keeps going past a skip and past a failure", () => {
    expect(keepScanning("skipped")).toBe(true);
    // o 30d é o primeiro da fila: parar na falha dele deixaria 7d, 1y e all sem pacote
    expect(keepScanning("failed")).toBe(true);
  });
});
