import { prisma } from "@/lib/db/prisma";
import { generateProviderEventKey } from "../domain/event-key";
import { ListeningHistoryProvider, ListenItem } from "../domain/listening-provider.interface";
import { normalizeText } from "../domain/normalization";
import { catalogIdentityKey, catalogMatch } from "../domain/catalog-identity";

export class ListeningSyncService {
  constructor(private provider: ListeningHistoryProvider) {}

  async runIncrementalSync(
    userId: string,
    providerName = "lastfm",
    overlapWindowSeconds = 7200
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

        if (page < totalPages) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        page++;
      } while (page <= totalPages);

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

  private async saveBatch(
    userId: string,
    providerName: string,
    items: ListenItem[]
  ): Promise<{ inserted: number; duplicates: number }> {
    if (items.length === 0) return { inserted: 0, duplicates: 0 };

    const uniqueNormalizedArtists = Array.from(
      new Set(items.map((i: ListenItem) => normalizeText(i.rawArtistName)))
    );

    const existingArtists = await prisma.artist.findMany({
      where: { normalizedName: { in: uniqueNormalizedArtists } },
    });

    // Positive cross-entity evidence only. Keep the original identifier for
    // review; never repair a historical artist by matching its name.
    const suspects = existingArtists.filter((artist) => artist.mbid && items.some((item) =>
      normalizeText(item.rawArtistName) === artist.normalizedName
      && item.recordingMbid === artist.mbid && item.artistMbid !== artist.mbid));
    if (suspects.length) await prisma.artist.updateMany({
      where: { id: { in: suspects.map((artist) => artist.id) } },
      data: { metadataStatus: "IDENTITY_REVIEW" },
    });

    const artistMap = new Map<string, string>();
    for (const item of items) {
      const key = catalogIdentityKey(item.rawArtistName, item.artistMbid);
      if (artistMap.has(key)) continue;
      const found = catalogMatch(existingArtists.filter((artist) => !suspects.includes(artist)
        && artist.metadataStatus !== "IDENTITY_REVIEW"), item.rawArtistName, item.artistMbid);
      if (found) {
        artistMap.set(key, found.id);
      } else {
        const created = await prisma.artist.create({
          data: {
            name: item.rawArtistName,
            normalizedName: normalizeText(item.rawArtistName),
            mbid: item.artistMbid,
          },
        });
        artistMap.set(key, created.id);
      }
    }

    const trackKeySet = new Set<string>();
    items.forEach((i: ListenItem) => {
      const artistId = artistMap.get(catalogIdentityKey(i.rawArtistName, i.artistMbid));
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

    const trackMap = new Map<string, string>();
    for (const item of items) {
      const artistId = artistMap.get(catalogIdentityKey(item.rawArtistName, item.artistMbid));
      const found = catalogMatch(existingTracks.filter((track) => track.artistId === artistId), item.rawTrackName, item.recordingMbid);
      if (found) trackMap.set(`${artistId}|${catalogIdentityKey(item.rawTrackName, item.recordingMbid)}`, found.id);
    }

    const missingTracksMap = new Map<string, { artistId: string; rawTrackName: string; normTrack: string; mbid?: string }>();
    items.forEach((i: ListenItem) => {
      const normTrack = normalizeText(i.rawTrackName);
      const artistId = artistMap.get(catalogIdentityKey(i.rawArtistName, i.artistMbid));
      if (artistId) {
        const key = `${artistId}|${catalogIdentityKey(i.rawTrackName, i.recordingMbid)}`;
        if (!trackMap.has(key) && !missingTracksMap.has(key)) {
          missingTracksMap.set(key, { artistId, rawTrackName: i.rawTrackName, normTrack, mbid: i.recordingMbid });
        }
      }
    });

    for (const [key, missing] of Array.from(missingTracksMap.entries())) {
      const created = await prisma.track.create({
        data: {
          artistId: missing.artistId,
          name: missing.rawTrackName,
          normalizedName: missing.normTrack,
          mbid: missing.mbid,
        },
      });
      trackMap.set(key, created.id);
    }

    const albumMap = new Map<string, string>();
    const albumItems = items.filter((i: ListenItem) => i.rawAlbumName && normalizeText(i.rawAlbumName));

    if (albumItems.length > 0) {
      const albumKeySet = new Set<string>();
      albumItems.forEach((i: ListenItem) => {
        const artistId = artistMap.get(catalogIdentityKey(i.rawArtistName, i.artistMbid));
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
        for (const item of albumItems) {
          const artistId = artistMap.get(catalogIdentityKey(item.rawArtistName, item.artistMbid));
          const found = catalogMatch(existingAlbums.filter((album) => album.artistId === artistId), item.rawAlbumName!, item.releaseMbid);
          if (found) albumMap.set(`${artistId}|${catalogIdentityKey(item.rawAlbumName!, item.releaseMbid)}`, found.id);
        }

        const missingAlbumsMap = new Map<string, { artistId: string; rawAlbumName: string; normAlbum: string; mbid?: string }>();
        albumItems.forEach((i: ListenItem) => {
          const artistId = artistMap.get(catalogIdentityKey(i.rawArtistName, i.artistMbid));
          const normAlbum = normalizeText(i.rawAlbumName!);
          if (artistId && normAlbum) {
            const key = `${artistId}|${catalogIdentityKey(i.rawAlbumName!, i.releaseMbid)}`;
            if (!albumMap.has(key) && !missingAlbumsMap.has(key)) {
              missingAlbumsMap.set(key, { artistId, rawAlbumName: i.rawAlbumName!, normAlbum, mbid: i.releaseMbid });
            }
          }
        });

        for (const [key, missing] of Array.from(missingAlbumsMap.entries())) {
          const created = await prisma.album.create({
            data: {
              artistId: missing.artistId,
              name: missing.rawAlbumName,
              normalizedName: missing.normAlbum,
              mbid: missing.mbid,
            },
          });
          albumMap.set(key, created.id);
        }
      }
    }

    const eventRecords = items.map((item: ListenItem) => {
      const normAlbum = item.rawAlbumName ? normalizeText(item.rawAlbumName) : null;
      const artistId = artistMap.get(catalogIdentityKey(item.rawArtistName, item.artistMbid));
      const trackId = artistId ? trackMap.get(`${artistId}|${catalogIdentityKey(item.rawTrackName, item.recordingMbid)}`) : undefined;
      const albumId = artistId && normAlbum ? albumMap.get(`${artistId}|${catalogIdentityKey(item.rawAlbumName!, item.releaseMbid)}`) : undefined;

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

    const result = await prisma.listeningEvent.createMany({
      data: eventRecords,
      skipDuplicates: true,
    });

    const inserted = result.count;
    const duplicates = items.length - inserted;

    return { inserted, duplicates };
  }
}
