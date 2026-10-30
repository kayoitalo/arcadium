import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    providerConnection: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    syncRun: { create: vi.fn(), update: vi.fn() },
    listeningEvent: { createMany: vi.fn() },
    artist: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    track: { findMany: vi.fn(), create: vi.fn() },
    album: { findMany: vi.fn(), create: vi.fn() },
  },
}));

import { prisma } from "@/lib/db/prisma";
import { ListeningHistoryProvider } from "../domain/listening-provider.interface";
import { ListeningSyncService } from "./sync-service";

const connection = { id: "connection-1", username: "listener", lastSyncedAt: null };

describe("ListeningSyncService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a second synchronization while the connection is locked", async () => {
    vi.mocked(prisma.providerConnection.findUnique).mockResolvedValue(connection as never);
    vi.mocked(prisma.providerConnection.updateMany).mockResolvedValue({ count: 0 });
    const provider = { fetchListens: vi.fn() } as unknown as ListeningHistoryProvider;

    await expect(new ListeningSyncService(provider).runIncrementalSync("user-1")).rejects.toThrow("already running");
    expect(prisma.syncRun.create).not.toHaveBeenCalled();
    expect(provider.fetchListens).not.toHaveBeenCalled();
  });

  it("records completion and releases the connection after an empty page", async () => {
    vi.mocked(prisma.providerConnection.findUnique).mockResolvedValue(connection as never);
    vi.mocked(prisma.providerConnection.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.syncRun.create).mockResolvedValue({ id: "run-1" } as never);
    const provider = {
      fetchListens: vi.fn().mockResolvedValue({ items: [], page: 1, totalPages: 1, totalItems: 0 }),
    } as unknown as ListeningHistoryProvider;

    const result = await new ListeningSyncService(provider).runIncrementalSync("user-1");

    expect(result).toEqual({ syncRunId: "run-1", fetched: 0, inserted: 0, duplicates: 0 });
    expect(prisma.syncRun.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "COMPLETED", fetchedCount: 0 }),
    }));
    expect(prisma.providerConnection.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "ACTIVE" }),
    }));
  });

  it("stores each MBID on its own entity and preserves raw version names", async () => {
    vi.mocked(prisma.providerConnection.findUnique).mockResolvedValue(connection as never);
    vi.mocked(prisma.providerConnection.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.syncRun.create).mockResolvedValue({ id: "run" } as never);
    vi.mocked(prisma.artist.findMany).mockResolvedValue([]);
    vi.mocked(prisma.track.findMany).mockResolvedValue([]);
    vi.mocked(prisma.album.findMany).mockResolvedValue([]);
    vi.mocked(prisma.artist.create).mockResolvedValue({ id: "artist" } as never);
    vi.mocked(prisma.track.create).mockResolvedValue({ id: "track" } as never);
    vi.mocked(prisma.album.create).mockResolvedValue({ id: "album" } as never);
    vi.mocked(prisma.listeningEvent.createMany).mockResolvedValue({ count: 1 });
    const item = { rawArtistName: "Band", rawTrackName: "Song (Live)", rawAlbumName: "Live Album",
      artistMbid: "artist-id", recordingMbid: "recording-id", releaseMbid: "release-id", playedAtUtcSeconds: 1700000000 };
    const provider = { fetchListens: vi.fn().mockResolvedValue({ items: [item], totalPages: 1 }) };
    await new ListeningSyncService(provider).runIncrementalSync("owner");
    expect(prisma.artist.create).toHaveBeenCalledWith({ data: expect.objectContaining({ mbid: "artist-id" }) });
    expect(prisma.track.create).toHaveBeenCalledWith({ data: expect.objectContaining({ mbid: "recording-id", name: "Song (Live)" }) });
    expect(prisma.album.create).toHaveBeenCalledWith({ data: expect.objectContaining({ mbid: "release-id" }) });
    expect(prisma.listeningEvent.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({
      artistId: "artist", trackId: "track", albumId: "album", rawTrackName: "Song (Live)",
    })] }));
  });

  it("marks positive cross-entity evidence for review without rewriting the old identifier", async () => {
    vi.mocked(prisma.providerConnection.findUnique).mockResolvedValue(connection as never);
    vi.mocked(prisma.providerConnection.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.syncRun.create).mockResolvedValue({ id: "run" } as never);
    vi.mocked(prisma.artist.findMany).mockResolvedValue([{ id: "suspect", normalizedName: "band", mbid: "recording-id" }] as never);
    vi.mocked(prisma.track.findMany).mockResolvedValue([]);
    vi.mocked(prisma.artist.create).mockResolvedValue({ id: "correct-artist" } as never);
    vi.mocked(prisma.track.create).mockResolvedValue({ id: "track" } as never);
    vi.mocked(prisma.listeningEvent.createMany).mockResolvedValue({ count: 1 });
    await new ListeningSyncService({ fetchListens: vi.fn().mockResolvedValue({ items: [{
      rawArtistName: "Band", rawTrackName: "Song", artistMbid: "artist-id",
      recordingMbid: "recording-id", playedAtUtcSeconds: 1700000000,
    }], totalPages: 1 }) }).runIncrementalSync("owner");
    expect(prisma.artist.updateMany).toHaveBeenCalledWith({ where: { id: { in: ["suspect"] } }, data: { metadataStatus: "IDENTITY_REVIEW" } });
    expect(prisma.listeningEvent.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ artistId: "correct-artist" })] }));
  });
});
