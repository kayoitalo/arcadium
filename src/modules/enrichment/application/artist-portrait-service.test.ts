import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ group: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { listeningEvent: { groupBy: db.group } } }));
import { ArtistPortraitService } from "./artist-portrait-service";
beforeEach(() => vi.resetAllMocks());

describe("owned photo references", () => {
  it("rejects another account's artist before provider work", async () => {
    db.group.mockResolvedValue([]); const lookup = vi.fn();
    await expect(new ArtistPortraitService({ lookup }).load("owner", "Other")).rejects.toMatchObject({ status: 404 });
    expect(lookup).not.toHaveBeenCalled();
    expect(db.group.mock.calls[0][0]).toMatchObject({ where: { userId: "owner", rawArtistName: "Other" }, take: 1 });
  });
  it("uses only the most observed exact title as catalog corroboration, without requiring an MBID", async () => {
    db.group.mockResolvedValue([{ rawTrackName: "Song (Live)", _count: { rawTrackName: 12 } }]);
    const lookup = vi.fn().mockResolvedValue({ status: "MISSING", reason: "NO_MATCH" });
    expect(await new ArtistPortraitService({ lookup }).load("owner", "Artist")).toMatchObject({ reason: "NO_MATCH" });
    expect(lookup).toHaveBeenCalledExactlyOnceWith({ artistName: "Artist", trackName: "Song (Live)" });
    expect(db.group.mock.calls[0][0].orderBy).toEqual([{ _count: { rawTrackName: "desc" } }, { rawTrackName: "asc" }]);
  });
  it("does not search without a usable owned track and distinguishes temporary failure", async () => {
    const lookup = vi.fn(); db.group.mockResolvedValue([{ rawTrackName: " " }]);
    expect(await new ArtistPortraitService({ lookup }).load("owner", "Artist")).toMatchObject({ reason: "NO_REFERENCE" });
    expect(lookup).not.toHaveBeenCalled(); db.group.mockResolvedValue([{ rawTrackName: "Song" }]); lookup.mockRejectedValue(new Error());
    await expect(new ArtistPortraitService({ lookup }).load("owner", "Artist")).rejects.toMatchObject({ status: 503, code: "PHOTO_TEMPORARY" });
  });
});
