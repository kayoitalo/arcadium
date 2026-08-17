import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    providerConnection: { findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    syncRun: { create: vi.fn(), update: vi.fn() },
    listeningEvent: { createMany: vi.fn() },
    artist: { findMany: vi.fn(), create: vi.fn() },
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
});
