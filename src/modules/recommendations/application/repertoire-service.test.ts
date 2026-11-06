import { beforeEach, describe, it, expect, vi } from "vitest";
const db = vi.hoisted(() => ({ events: vi.fn(), tracks: vi.fn(), albums: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { listeningEvent: { groupBy: db.events }, track: { findMany: db.tracks }, album: { findMany: db.albums } } }));
import { restrictedRepertoire } from "./repertoire-service";
const track = () => ({ id: "t", artistId: "artist", name: "Song (Live)", itunesTrackId: "43", durationMs: 180000,
  appleMusicUrl: "https://music.apple.com/br/album/example/42?i=43", previewUrl: "https://audio-ssl.itunes.apple.com/preview.m4a",
  enrichedAt: new Date(), artist: { name: "A" } });
const album = () => ({ id: "a", artistId: "artist", name: "Album", itunesGenre: "Jazz", itunesCollectionId: "42", itunesFetchedAt: new Date(), artist: { name: "A" } });
beforeEach(() => { vi.resetAllMocks(); db.events.mockResolvedValue([{ rawArtistName: "A", rawTrackName: "Song (Live)", rawAlbumName: "Album", trackId: "t", albumId: "a", _count: { id: 2 }, _max: { playedAt: new Date() } }]); db.tracks.mockResolvedValue([track()]); db.albums.mockResolvedValue([album()]); });
describe("evidence-only repertoire restrictions", () => {
  it("intersects album classification and known duration, scoped to the account", async () => {
    const result = await restrictedRepertoire("owner", { albumGenre: "jazz", maxDurationMs: 200000 });
    expect(result).toHaveLength(1); expect(result[0].trackName).toBe("Song (Live)");
    expect(db.events.mock.calls[0][0].where.userId).toBe("owner"); expect(result[0].evidence?.[0].kind).toBe("repertoire_metadata");
    expect(result[0].repertoireRecording).toMatchObject({ identity: { sourceId: "43" }, catalogFacts: { durationMs: 180000 } });
  });
  it("keeps album classification usable when duration belongs to a different edition", async () => {
    db.tracks.mockResolvedValue([{ ...track(), appleMusicUrl: "https://music.apple.com/br/album/reissue/99?i=43" }]);
    expect(await restrictedRepertoire("owner", { maxDurationMs: 200000 })).toEqual([]);
    const results = await restrictedRepertoire("owner", { albumGenre: "jazz" });
    expect(results).toHaveLength(1);
    expect(results[0].repertoireRecording).toBeUndefined();
  });
  it("excludes missing evidence, wrong version and wrong album instead of widening", async () => {
    db.tracks.mockResolvedValue([{ ...track(), name: "Song" }]); expect(await restrictedRepertoire("owner", { maxDurationMs: 200000 })).toEqual([]);
    db.tracks.mockResolvedValue([{ ...track(), durationMs: null }]); expect(await restrictedRepertoire("owner", { maxDurationMs: 200000 })).toEqual([]);
    db.tracks.mockResolvedValue([track()]); db.albums.mockResolvedValue([{ ...album(), itunesFetchedAt: null }]); expect(await restrictedRepertoire("owner", { albumGenre: "jazz" })).toEqual([]);
    db.albums.mockResolvedValue([{ ...album(), name: "Other" }]); expect(await restrictedRepertoire("owner", { albumGenre: "jazz" })).toEqual([]);
  });
});
