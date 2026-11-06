import { prisma } from "@/lib/db/prisma";
import { sameRecordingText } from "@/lib/music/recording-match";
import type { RepertoireRestriction } from "../domain/territories";
import type { RawCandidate } from "../domain/recommendation.types";
import { mergeCandidates } from "./hybrid-candidates";
import { catalogTrackURL, catalogURL } from "../domain/album-journey";

/** Album classification is not a recording-level genre claim. Duration is only
 * used when an exact textual track/artist binding exists; unknowns are excluded. */
export async function restrictedRepertoire(userId: string, restriction: RepertoireRestriction): Promise<RawCandidate[]> {
  const rows = await prisma.listeningEvent.groupBy({ by: ["rawArtistName", "rawTrackName", "rawAlbumName", "trackId", "albumId"],
    where: { userId, ...(restriction.albumGenre ? { album: { itunesGenre: { equals: restriction.albumGenre, mode: "insensitive" as const } } } : {}),
      ...(restriction.maxDurationMs ? { track: { durationMs: { gt: 0, lte: restriction.maxDurationMs } } } : {}) },
    _count: { id: true }, _max: { playedAt: true }, orderBy: [{ _count: { id: "desc" } }, { rawArtistName: "asc" }, { rawTrackName: "asc" },
      { rawAlbumName: "asc" }, { trackId: "asc" }, { albumId: "asc" }], take: 500 });
  if (!rows.length) return [];
  const [tracks, albums] = await Promise.all([
    prisma.track.findMany({ where: { id: { in: rows.flatMap((row) => row.trackId ? [row.trackId] : []) } }, include: { artist: true } }),
    prisma.album.findMany({ where: { id: { in: rows.flatMap((row) => row.albumId ? [row.albumId] : []) } }, include: { artist: true } }),
  ]);
  const tracksById = new Map(tracks.map((track) => [track.id, track]));
  const albumsById = new Map(albums.map((album) => [album.id, album]));
  const result: RawCandidate[] = [];
  for (const row of rows) {
    const track = row.trackId ? tracksById.get(row.trackId) : undefined;
    const album = row.albumId ? albumsById.get(row.albumId) : undefined;
    const albumMatches = album && row.rawAlbumName && album.itunesFetchedAt && album.itunesCollectionId
      && sameRecordingText(album.name, row.rawAlbumName) && sameRecordingText(album.artist.name, row.rawArtistName);
    if (restriction.albumGenre && (!albumMatches || album.itunesGenre?.toLowerCase() !== restriction.albumGenre.toLowerCase())) continue;

    // A Track can be shared across albums. Only use duration and preview when
    // the stored Apple recording belongs to the album observed in this event.
    let repertoireRecording: RawCandidate["repertoireRecording"];
    if (albumMatches && track?.itunesTrackId && track.enrichedAt && track.artistId === album.artistId
      && sameRecordingText(track.name, row.rawTrackName) && sameRecordingText(track.artist.name, row.rawArtistName)) {
      const url = catalogTrackURL(track.appleMusicUrl, track.itunesTrackId, album.itunesCollectionId!);
      if (url) repertoireRecording = {
        identity: { source: "itunes", sourceId: track.itunesTrackId, artistName: track.artist.name, trackName: track.name, match: "compatible-text-v1" },
        appleMusicUrl: url,
        previewUrl: catalogURL(track.previewUrl),
        catalogFacts: { durationMs: track.durationMs, fetchedAt: track.enrichedAt.toISOString() },
      };
    }
    const duration = repertoireRecording?.catalogFacts.durationMs;
    if (restriction.maxDurationMs && (!duration || duration < 0 || duration > restriction.maxDurationMs)) continue;
    result.push({ artistName: row.rawArtistName, trackName: row.rawTrackName, albumName: row.rawAlbumName ?? undefined,
      trackId: track?.id, repertoireRecording, source: "history_repertoire", evidence: [{ kind: "repertoire_metadata", source: "catalog", genre: restriction.albumGenre,
        playCount: row._count.id, lastPlayedAt: row._max.playedAt?.toISOString() }] });
  }
  return mergeCandidates(result);
}
