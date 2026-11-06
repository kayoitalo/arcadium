import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ many: vi.fn(), groups: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { artist: { findMany: db.many, groupBy: db.groups } } }));
import { TerritoryService, assertSupportedRestrictions } from "./territory-service";
import { TERRITORY_VERSION, CURATION_PROPOSALS } from "../domain/territories";
const artist = (name: string, tags = "dub") => ({ id: name, name, tags, mbid: null, enrichedAt: new Date(), tracks: [{ id: name + "-t", name: "Track (Live)" }] });
beforeEach(() => vi.resetAllMocks());
describe("destination-scoped territory doors", () => {
  it("uses exact tags, excludes observed artists and ambiguous catalog identities", async () => {
    db.many.mockResolvedValue([artist("Known"), artist("Known & Guest"), artist("A"), artist("B", "dubstep"), artist("Collision")]);
    db.groups.mockResolvedValue([{ name: "A", _count: { id: 1 } }, { name: "Collision", _count: { id: 2 } }]);
    const snapshot = await new TerritoryService().resolve({ version: TERRITORY_VERSION, genre: "dub" }, new Set(["known"]));
    expect(snapshot.artists.map((row) => row.name)).toEqual(["A"]);
    expect(snapshot).toMatchObject({ version: TERRITORY_VERSION, scope: "artist-tag", genre: "dub" });
    expect(CURATION_PROPOSALS.every((row) => row.status === "PROPOSED" && row.anchor.sourceUrl)).toBe(true);
  });
  it("never expands into similarity/profile calls when a destination has no tracks", async () => {
    const provider = { isConfigured: () => true, beginDiscoveryWindow: vi.fn(), getTopTracks: vi.fn().mockResolvedValue([]), getSimilarTracks: vi.fn(), getSimilarArtists: vi.fn(), getArtistReach: vi.fn() };
    const selected = await new TerritoryService().candidates({ version: TERRITORY_VERSION, genre: "dub", scope: "artist-tag", capturedAt: new Date().toISOString(), artists: [{ ...artist("A"), enrichedAt: new Date().toISOString(), tracks: [] }] }, provider);
    expect(selected).toEqual([]); expect(provider.getTopTracks).toHaveBeenCalledWith("A", 3);
    expect(provider.getSimilarTracks).not.toHaveBeenCalled(); expect(provider.getSimilarArtists).not.toHaveBeenCalled(); expect(provider.getArtistReach).not.toHaveBeenCalled();
  });
  it("preserves qualifiers, refuses cross-artist results and works from local catalog without providers", async () => {
    const destination = { version: TERRITORY_VERSION, genre: "dub", scope: "artist-tag" as const, capturedAt: new Date().toISOString(), artists: [{ ...artist("A"), enrichedAt: new Date().toISOString() }] };
    const provider = { isConfigured: () => false, getTopTracks: vi.fn(), getSimilarArtists: vi.fn(), getArtistReach: vi.fn() };
    expect((await new TerritoryService().candidates(destination, provider))[0].trackName).toBe("Track (Live)"); expect(provider.getTopTracks).not.toHaveBeenCalled();
    provider.isConfigured = () => true; provider.getTopTracks.mockResolvedValue([{ artistName: "Other", trackName: "Wrong" }, { artistName: "A", trackName: "Track (Remix)" }]);
    expect((await new TerritoryService().candidates(destination, provider)).map((row) => row.trackName)).toEqual(["Track (Live)", "Track (Remix)"]);
  });
  it("makes unsupported moment/voice restrictions explicit before any source call", () => {
    expect(() => assertSupportedRestrictions({ moment: "WORKING" })).toThrow();
    expect(() => assertSupportedRestrictions({ vocals: "INSTRUMENTAL" })).toThrow();
    expect(() => assertSupportedRestrictions({})).not.toThrow();
  });
});
