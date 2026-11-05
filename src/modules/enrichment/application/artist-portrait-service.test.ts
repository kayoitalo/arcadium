import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ group: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { listeningEvent: { groupBy: db.group } } }));
import { ArtistPortraitService } from "./artist-portrait-service";
const fallback = { getArtistPortrait: vi.fn() };
beforeEach(() => { vi.resetAllMocks(); fallback.getArtistPortrait.mockResolvedValue({ status: "MISSING", reason: "NOT_CONFIGURED" }); });

describe("owned photo references", () => {
  it("rejects another account's artist before provider work", async () => {
    db.group.mockResolvedValue([]); const lookup = vi.fn();
    await expect(new ArtistPortraitService({ lookup }, fallback).load("owner", "Other")).rejects.toMatchObject({ status: 404 });
    expect(lookup).not.toHaveBeenCalled();
    expect(db.group.mock.calls[0][0]).toMatchObject({ where: { userId: "owner", rawArtistName: "Other" }, take: 1 });
  });
  it("uses only the most observed exact title as catalog corroboration, without requiring an MBID", async () => {
    db.group.mockResolvedValue([{ rawTrackName: "Song (Live)", _count: { rawTrackName: 12 } }]);
    const lookup = vi.fn().mockResolvedValue({ status: "MISSING", reason: "NO_MATCH" });
    expect(await new ArtistPortraitService({ lookup }, fallback).load("owner", "Artist")).toMatchObject({ reason: "NO_MATCH" });
    expect(lookup).toHaveBeenCalledExactlyOnceWith({ artistName: "Artist", trackName: "Song (Live)" });
    expect(db.group.mock.calls[0][0].orderBy).toEqual([{ _count: { rawTrackName: "desc" } }, { rawTrackName: "asc" }]);
  });
  it("does not search without a usable owned track and distinguishes temporary failure", async () => {
    const lookup = vi.fn(); db.group.mockResolvedValue([{ rawTrackName: " " }]);
    expect(await new ArtistPortraitService({ lookup }, fallback).load("owner", "Artist")).toMatchObject({ reason: "NO_REFERENCE" });
    expect(lookup).not.toHaveBeenCalled(); db.group.mockResolvedValue([{ rawTrackName: "Song" }]); lookup.mockRejectedValue(new Error());
    await expect(new ArtistPortraitService({ lookup }, fallback).load("owner", "Artist")).rejects.toMatchObject({ status: 503, code: "PHOTO_TEMPORARY" });
  });
  it.each(["unconfigured", "failure"])("uses Last.fm within scope when Spotify is %s", async problem => {
    db.group.mockResolvedValue([{ rawTrackName: "Song" }]);
    const lookup = problem === "failure" ? vi.fn().mockRejectedValue(new Error()) : vi.fn().mockResolvedValue({ status: "MISSING", reason: "NOT_CONFIGURED" });
    const photo = { status: "READY", provider: "lastfm", artistName: "Artist", imageUrl: "https://lastfm.freetls.fastly.net/i/u/300x300/synthetic.jpg", sourceUrl: "https://www.last.fm/music/Artist", checkedAt: new Date().toISOString() };
    fallback.getArtistPortrait.mockResolvedValue(photo);
    expect(await new ArtistPortraitService({ lookup }, fallback).load("owner", "Artist")).toEqual(photo);
    expect(fallback.getArtistPortrait).toHaveBeenCalledExactlyOnceWith("Artist");
  });
  it("never masks Spotify identity ambiguity with a name-only fallback", async () => {
    db.group.mockResolvedValue([{ rawTrackName: "Song" }]); const lookup = vi.fn().mockResolvedValue({ status: "MISSING", reason: "AMBIGUOUS" });
    expect(await new ArtistPortraitService({ lookup }, fallback).load("owner", "Artist")).toMatchObject({ reason: "AMBIGUOUS" });
    expect(fallback.getArtistPortrait).not.toHaveBeenCalled();
  });
});
