import { prisma } from "@/lib/db/prisma";
import { generateProviderEventKey } from "../domain/event-key";
import { ListeningHistoryProvider, ListenItem } from "../domain/listening-provider.interface";
import { normalizeText } from "../domain/normalization";

export class ListeningSyncService {
  constructor(private provider: ListeningHistoryProvider) {}

  /**
   * Performs incremental sync using a safety overlap window.
   * Moves cursor back by overlapWindowSeconds to catch delayed/reordered scrobbles.
   */
  async runIncrementalSync(
    userId: string,
    providerName = "lastfm",
    overlapWindowSeconds = 7200 // 2 hours safety overlap
  ) {
    const connection = await prisma.providerConnection.findUnique({
      where: { userId_provider: { userId, provider: providerName } },
    });

    if (!connection) {
      throw new Error(`Provider connection '${providerName}' not found for user ${userId}`);
    }

    const lock = await prisma.providerConnection.updateMany({
      where: { id: connection.id, status: { not: "SYNCING" } },
      data: { status: "SYNCING" },
    });
    if (lock.count === 0) {
      throw new Error("A synchronization is already running for this Last.fm connection.");
    }

    let syncRun;
    try {
      syncRun = await prisma.syncRun.create({
        data: { connectionId: connection.id, type: "INCREMENTAL", status: "RUNNING" },
      });
    } catch (error) {
      await prisma.providerConnection.update({ where: { id: connection.id }, data: { status: "ERROR" } });
      throw error;
    }

    try {
      let fromTimestamp: number | undefined;
      if (connection.lastSyncedAt) {
        const lastSyncedSeconds = Math.floor(connection.lastSyncedAt.getTime() / 1000);
        fromTimestamp = Math.max(0, lastSyncedSeconds - overlapWindowSeconds);
      }

      let page = 1;
      let totalPages = 1;
      let totalFetched = 0;
      let totalInserted = 0;
      let totalDuplicates = 0;
      let latestPlayedAt: Date | null = connection.lastSyncedAt;

      do {
        const result = await this.provider.fetchListens({
          username: connection.username,
          page,
          limit: 200,
          from: fromTimestamp,
        });

        totalPages = result.totalPages;
        totalFetched += result.items.length;

        if (result.items.length > 0) {
          const batchStats = await this.saveBatch(userId, providerName, result.items);
          totalInserted += batchStats.inserted;
          totalDuplicates += batchStats.duplicates;

          // Track latest playedAt date
          for (const item of result.items) {
            const itemDate = new Date(item.playedAtUtcSeconds * 1000);
            if (!latestPlayedAt || itemDate > latestPlayedAt) {
              latestPlayedAt = itemDate;
            }
          }
        }


        await prisma.syncRun.update({
          where: { id: syncRun.id },
          data: {
            cursor: String(page), fetchedCount: totalFetched,
            insertedCount: totalInserted, duplicateCount: totalDuplicates,
          },
        });

        // Polite pause between pages to respect Last.fm guidance
        if (page < totalPages) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        page++;
      } while (page <= totalPages);

      // Update provider connection status and lastSyncedAt
      await prisma.providerConnection.update({
        where: { id: connection.id },
        data: {
          lastSyncedAt: latestPlayedAt || new Date(),
          status: "ACTIVE",
        },
      });

      await prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: "COMPLETED",
          fetchedCount: totalFetched,
          insertedCount: totalInserted,
          duplicateCount: totalDuplicates,
          finishedAt: new Date(),
        },
      });

      return {
        syncRunId: syncRun.id,
        fetched: totalFetched,
        inserted: totalInserted,
        duplicates: totalDuplicates,
      };
    } catch (error: any) {
      console.error("Sync failure:", error);
      await prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          status: "FAILED",
          errorCode: error?.name || "SYNC_ERROR",
          errorMessage: error?.message || "Unknown error during sync",
          finishedAt: new Date(),
        },
      });
      await prisma.providerConnection.update({
        where: { id: connection.id },
        data: { status: "ERROR" },
      });
      throw error;
    }
  }

  /**
   * Processes a batch of ListenItems in bulk for maximum speed and database efficiency.
   * Resolves Artists, Tracks, and Albums in bulk, then uses `createMany({ skipDuplicates: true })`.
   */
  private async saveBatch(
    userId: string,
    providerName: string,
    items: ListenItem[]
  ): Promise<{ inserted: number; duplicates: number }> {
    if (items.length === 0) return { inserted: 0, duplicates: 0 };

    // 1. Bulk resolve Artists
    const uniqueNormalizedArtists = Array.from(
      new Set(items.map((i: ListenItem) => normalizeText(i.rawArtistName)))
    );

    const existingArtists = await prisma.artist.findMany({
      where: { normalizedName: { in: uniqueNormalizedArtists } },
    });

    const artistMap = new Map<string, string>(); // normName -> artistId
    existingArtists.forEach((a: { id: string; normalizedName: string }) => artistMap.set(a.normalizedName, a.id));

    // Find missing artists
    const missingArtists = items.filter((i: ListenItem) => !artistMap.has(normalizeText(i.rawArtistName)));
    if (missingArtists.length > 0) {
      const missingMap = new Map<string, ListenItem>();
      missingArtists.forEach((i: ListenItem) => {
        const norm = normalizeText(i.rawArtistName);
        if (!missingMap.has(norm)) missingMap.set(norm, i);
      });

      for (const [norm, item] of Array.from(missingMap.entries())) {
        const created = await prisma.artist.create({
          data: {
            name: item.rawArtistName,
            normalizedName: norm,
            mbid: item.mbid,
          },
        });
        artistMap.set(norm, created.id);
      }
    }

    // 2. Bulk resolve Tracks
    const trackKeySet = new Set<string>();
    items.forEach((i: ListenItem) => {
      const artistId = artistMap.get(normalizeText(i.rawArtistName));
      if (artistId) {
        trackKeySet.add(`${artistId}|${normalizeText(i.rawTrackName)}`);
      }
    });

    const existingTracks = await prisma.track.findMany({
      where: {
        OR: Array.from(trackKeySet).map((key) => {
          const [artistId, normalizedName] = key.split("|");
          return { artistId, normalizedName };
        }),
      },
    });

    const trackMap = new Map<string, string>(); // artistId|normTrack -> trackId
    existingTracks.forEach((t: { id: string; artistId: string; normalizedName: string }) => trackMap.set(`${t.artistId}|${t.normalizedName}`, t.id));

    const missingTracksMap = new Map<string, { artistId: string; rawTrackName: string; normTrack: string }>();
    items.forEach((i: ListenItem) => {
      const normArtist = normalizeText(i.rawArtistName);
      const normTrack = normalizeText(i.rawTrackName);
      const artistId = artistMap.get(normArtist);
      if (artistId) {
        const key = `${artistId}|${normTrack}`;
        if (!trackMap.has(key) && !missingTracksMap.has(key)) {
          missingTracksMap.set(key, { artistId, rawTrackName: i.rawTrackName, normTrack });
        }
      }
    });

    for (const [key, missing] of Array.from(missingTracksMap.entries())) {
      const created = await prisma.track.create({
        data: {
          artistId: missing.artistId,
          name: missing.rawTrackName,
          normalizedName: missing.normTrack,
        },
      });
      trackMap.set(key, created.id);
    }

    // 3. Bulk resolve Albums (optional)
    const albumMap = new Map<string, string>(); // artistId|normAlbum -> albumId
    const albumItems = items.filter((i: ListenItem) => i.rawAlbumName && normalizeText(i.rawAlbumName));

    if (albumItems.length > 0) {
      const albumKeySet = new Set<string>();
      albumItems.forEach((i: ListenItem) => {
        const artistId = artistMap.get(normalizeText(i.rawArtistName));
        if (artistId) {
          albumKeySet.add(`${artistId}|${normalizeText(i.rawAlbumName!)}`);
        }
      });

      if (albumKeySet.size > 0) {
        const existingAlbums = await prisma.album.findMany({
          where: {
            OR: Array.from(albumKeySet).map((key) => {
              const [artistId, normalizedName] = key.split("|");
              return { artistId, normalizedName };
            }),
          },
        });
        existingAlbums.forEach((a: { id: string; artistId: string; normalizedName: string }) => albumMap.set(`${a.artistId}|${a.normalizedName}`, a.id));

        const missingAlbumsMap = new Map<string, { artistId: string; rawAlbumName: string; normAlbum: string }>();
        albumItems.forEach((i: ListenItem) => {
          const artistId = artistMap.get(normalizeText(i.rawArtistName));
          const normAlbum = normalizeText(i.rawAlbumName!);
          if (artistId && normAlbum) {
            const key = `${artistId}|${normAlbum}`;
            if (!albumMap.has(key) && !missingAlbumsMap.has(key)) {
              missingAlbumsMap.set(key, { artistId, rawAlbumName: i.rawAlbumName!, normAlbum });
            }
          }
        });

        for (const [key, missing] of Array.from(missingAlbumsMap.entries())) {
          const created = await prisma.album.create({
            data: {
              artistId: missing.artistId,
              name: missing.rawAlbumName,
              normalizedName: missing.normAlbum,
            },
          });
          albumMap.set(key, created.id);
        }
      }
    }

    // 4. Construct ListeningEvent bulk records
    const eventRecords = items.map((item: ListenItem) => {
      const normArtist = normalizeText(item.rawArtistName);
      const normTrack = normalizeText(item.rawTrackName);
      const normAlbum = item.rawAlbumName ? normalizeText(item.rawAlbumName) : null;
      const artistId = artistMap.get(normArtist);
      const trackId = artistId ? trackMap.get(`${artistId}|${normTrack}`) : undefined;
      const albumId = artistId && normAlbum ? albumMap.get(`${artistId}|${normAlbum}`) : undefined;

      const eventKey = generateProviderEventKey(
        userId,
        providerName,
        item.playedAtUtcSeconds,
        item.rawArtistName,
        item.rawTrackName
      );

      return {
        userId,
        playedAt: new Date(item.playedAtUtcSeconds * 1000),
        provider: providerName,
        providerEventKey: eventKey,
        rawArtistName: item.rawArtistName,
        rawTrackName: item.rawTrackName,
        rawAlbumName: item.rawAlbumName,
        artistId: artistId || null,
        trackId: trackId || null,
        albumId: albumId || null,
      };
    });

    // 5. Bulk insert with skipDuplicates
    const result = await prisma.listeningEvent.createMany({
      data: eventRecords,
      skipDuplicates: true,
    });

    const inserted = result.count;
    const duplicates = items.length - inserted;

    return { inserted, duplicates };
  }
}
