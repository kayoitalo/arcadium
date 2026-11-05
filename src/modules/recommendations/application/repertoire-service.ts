import { prisma } from "@/lib/db/prisma";
import { sameRecordingText } from "@/lib/music/recording-match";
import type { RepertoireRestriction } from "../domain/territories";
import type { RawCandidate } from "../domain/recommendation.types";
import { mergeCandidates } from "./hybrid-candidates";

/** Album classification is not a recording-level genre claim. Duration is only
 * used when an exact textual track/artist binding exists; unknowns are excluded. */
export async function restrictedRepertoire(userId: string, restriction: RepertoireRestriction): Promise<RawCandidate[]> {
  const rows = await prisma.listeningEvent.groupBy({ by: ["rawArtistName", "rawTrackName", "rawAlbumName", "trackId", "albumId"],
    where: { userId, ...(restriction.albumGenre ? { album: { itunesGenre: { equals: restriction.albumGenre, mode: "insensitive" as const } } } : {}),
      ...(restriction.maxDurationMs ? { track: { durationMs: { gt: 0, lte: restriction.maxDurationMs } } } : {}) },
    _count: { id: true }, _max: { playedAt: true }, orderBy: [{ _count: { id: "desc" } }, { rawArtistName: "asc" }, { rawTrackName: "asc" }], take: 500 });
  const [tracks, albums] = await Promise.all([
    prisma.track.findMany({ where: { id: { in: rows.flatMap((row) => row.trackId ? [row.trackId] : []) } }, include: { artist: true } }),
    prisma.album.findMany({ where: { id: { in: rows.flatMap((row) => row.albumId ? [row.albumId] : []) } }, include: { artist: true } }),
  ]);
  const result: RawCandidate[] = [];
  for (const row of rows) {
    const track = tracks.find((value) => value.id === row.trackId);
    const album = albums.find((value) => value.id === row.albumId);
    if (restriction.maxDurationMs && (!track || !track.itunesTrackId || !track.enrichedAt || !sameRecordingText(track.name, row.rawTrackName)
      || !sameRecordingText(track.artist.name, row.rawArtistName) || !track.durationMs || track.durationMs > restriction.maxDurationMs)) continue;
    if (restriction.albumGenre && (!album || !row.rawAlbumName || !sameRecordingText(album.name, row.rawAlbumName)
      || !sameRecordingText(album.artist.name, row.rawArtistName) || !album.itunesFetchedAt
      || album.itunesGenre?.toLowerCase() !== restriction.albumGenre.toLowerCase())) continue;
    result.push({ artistName: row.rawArtistName, trackName: row.rawTrackName, albumName: row.rawAlbumName ?? undefined,
      trackId: track?.id, source: "history_repertoire", evidence: [{ kind: "repertoire_metadata", source: "catalog", genre: restriction.albumGenre,
        playCount: row._count.id, lastPlayedAt: row._max.playedAt?.toISOString() }] });
  }
  return mergeCandidates(result);
}
