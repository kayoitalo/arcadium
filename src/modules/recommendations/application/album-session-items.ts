import type { AlbumEdition, EditionTrack } from "../domain/album-journey";
import { catalogTrackURL } from "../domain/album-journey";
import type { curatedRecordingCue } from "../domain/curated-albums";
import type { WeeklyCredit } from "../domain/weekly-journey";

export function albumSessionItems(
  edition: AlbumEdition,
  credit?: (track: EditionTrack, index: number) => ReturnType<typeof curatedRecordingCue> | WeeklyCredit | null,
) {
  const { album, tracks } = edition;
  return tracks.map((track, index) => {
    const cue = credit?.(track, index);
    return {
      artistName: track.artistName, trackName: track.trackName, albumName: album.albumName, score: 0, rank: index + 1,
      reason: `Disco ${track.disc}, faixa ${track.number} de “${album.albumName}”, na edição que você escolheu.`,
      coverUrl: album.artworkUrl, previewUrl: track.previewUrl, appleMusicUrl: track.sourceUrl ?? album.sourceUrl,
      scoreComponents: {
        albumEdition: { ...album, trackId: track.trackId, disc: track.disc, number: track.number },
        ...(credit && (!cue || "kind" in cue) ? { recordingCue: cue ?? null } : {}),
        ...(cue && !("kind" in cue) && catalogTrackURL(track.sourceUrl, track.trackId, album.collectionId) ? {
          weeklyRecordingCredit: { credit: cue, trackId: track.trackId, collectionId: album.collectionId, storefront: album.storefront },
        } : {}),
        catalogFacts: { durationMs: track.durationMs, fetchedAt: album.fetchedAt },
        previewIdentity: { source: "itunes", sourceId: track.trackId, artistName: track.artistName, trackName: track.trackName, match: "compatible-text-v1" },
      },
    };
  });
}
