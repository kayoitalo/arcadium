import { prisma } from "@/lib/db/prisma";
import { recordingText } from "@/lib/music/recording-match";
import { normalizeText } from "@/modules/listening/domain/normalization";
import { weeklyAlbumKey } from "../domain/weekly-journey";

export function weeklyAlbumHistoryKeys(artist: string, title: string, group?: string | null, collectionId?: string | null) {
  return [weeklyAlbumKey(artist, title), ...(group ? [weeklyAlbumKey(artist, title, group)] : []),
    ...(collectionId ? [`collection:${collectionId}`] : [])];
}

/** An often-played single track may still be a doorway to the rest of its album. */
export async function familiarWeeklyAlbums(userId: string, names: string[]): Promise<Set<string>> {
  const artists = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (!artists.length) return new Set();
  const rows = await prisma.listeningEvent.groupBy({
    by: ["albumId", "rawArtistName", "rawAlbumName", "rawTrackName"],
    where: { userId, OR: [
      { rawArtistName: { in: artists, mode: "insensitive" }, rawAlbumName: { not: null } },
      { album: { artist: { normalizedName: { in: [...new Set(artists.map(normalizeText))] } } } },
    ] },
    _count: { id: true },
  });
  const ids = [...new Set(rows.flatMap((row) => row.albumId ? [row.albumId] : []))];
  const albums = ids.length ? await prisma.album.findMany({ where: { id: { in: ids } }, select: {
    id: true, name: true, itunesCollectionId: true, releaseGroupMbid: true, artist: { select: { name: true } },
  } }) : [];
  const byId = new Map(albums.map((album) => [album.id, album]));
  const totals = new Map<string, { plays: number; tracks: Set<string> }>();
  for (const row of rows) {
    const track = recordingText(row.rawTrackName.replace(/\s*[([](?:feat\.?|featuring)\b[^)\]]*[)\]]/gi, ""));
    if (!track) continue;
    const album = row.albumId ? byId.get(row.albumId) : undefined;
    const keys = new Set(row.rawAlbumName?.trim() ? [weeklyAlbumKey(row.rawArtistName, row.rawAlbumName)] : []);
    if (album) for (const key of weeklyAlbumHistoryKeys(album.artist.name, album.name, album.releaseGroupMbid, album.itunesCollectionId)) {
      keys.add(key);
    }
    for (const key of keys) {
      const total = totals.get(key) ?? { plays: 0, tracks: new Set<string>() };
      total.plays += row._count.id;
      total.tracks.add(track);
      totals.set(key, total);
    }
  }
  return new Set([...totals].filter(([, total]) => total.plays >= 4 && total.tracks.size >= 2).map(([key]) => key));
}
