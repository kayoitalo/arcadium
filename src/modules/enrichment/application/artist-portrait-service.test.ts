import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ group: vi.fn(), lastfm: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { listeningEvent: { groupBy: mocks.group } } }));
vi.mock("@/modules/recommendations/infrastructure/lastfm-similar-adapter", () => ({ LastFmSimilarArtistProvider: mocks.lastfm }));
import { ArtistPortraitService } from "./artist-portrait-service";
beforeEach(() => vi.resetAllMocks());
describe("Spotify-only photo references", () => {
  it("rejects another account's artist before provider work", async () => {
    mocks.group.mockResolvedValue([]); const lookup = vi.fn();
    await expect(new ArtistPortraitService({ lookup }).load("owner", "Other")).rejects.toMatchObject({ status: 404 });
    expect(lookup).not.toHaveBeenCalled(); expect(mocks.lastfm).not.toHaveBeenCalled();
    expect(mocks.group.mock.calls[0][0]).toMatchObject({ where: { userId: "owner", rawArtistName: "Other" }, take: 1 });
  });
  it("supplies only the most observed owned title for potential homonym disambiguation", async () => {
    mocks.group.mockResolvedValue([{ rawTrackName: "Song (Live)", _count: { rawTrackName: 12 } }]);
    const lookup = vi.fn().mockResolvedValue({ status: "MISSING", reason: "NO_MATCH" });
    expect(await new ArtistPortraitService({ lookup }).load("owner", "Artist")).toMatchObject({ reason: "NO_MATCH" });
    expect(lookup).toHaveBeenCalledExactlyOnceWith({ artistName: "Artist", trackName: "Song (Live)" });
  });
  it.each(["NOT_CONFIGURED", "NO_IMAGE", "AMBIGUOUS"])("keeps Spotify %s without consulting Last.fm", async reason => {
    mocks.group.mockResolvedValue([{ rawTrackName: "Song" }]);
    const lookup = vi.fn().mockResolvedValue({ status: "MISSING", reason });
    expect(await new ArtistPortraitService({ lookup }).load("owner", "Artist")).toMatchObject({ reason });
    expect(lookup).toHaveBeenCalledOnce(); expect(mocks.lastfm).not.toHaveBeenCalled();
  });
  it("keeps temporary failure retryable without starting another provider", async () => {
    mocks.group.mockResolvedValue([{ rawTrackName: "Song" }]); const lookup = vi.fn().mockRejectedValue(new Error());
    await expect(new ArtistPortraitService({ lookup }).load("owner", "Artist")).rejects.toMatchObject({ status: 503, code: "PHOTO_TEMPORARY" });
    expect(lookup).toHaveBeenCalledOnce(); expect(mocks.lastfm).not.toHaveBeenCalled();
  });
});
