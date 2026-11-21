import { describe, expect, it } from "vitest";
import { emDia } from "./ficha";

describe("a ficha do caderno", () => {
  const now = new Date("2026-11-20T12:00:00Z").getTime();
  it("is up to date only with a recent search and no error in the last one", () => {
    expect(emDia({ username: "u", lastSyncedAt: "2026-11-19T22:00:00Z", failed: false }, now)).toBe(true);
    expect(emDia({ username: "u", lastSyncedAt: "2026-11-15T22:00:00Z", failed: false }, now)).toBe(false);
    expect(emDia({ username: "u", lastSyncedAt: "2026-11-19T22:00:00Z", failed: true }, now)).toBe(false);
    expect(emDia({ username: null, lastSyncedAt: null, failed: false }, now)).toBe(false);
  });
});
