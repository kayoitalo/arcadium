import { z } from "zod";
import { sameRecordingText } from "@/lib/music/recording-match";
export const albumSourceSchema = z.object({ kind: z.enum(["library", "recommendation", "curated"]), id: z.string().min(1).max(100) }).strict();
export type AlbumSource = z.infer<typeof albumSourceSchema>;
export const editionSummarySchema = z.object({
  provider: z.literal("itunes"), collectionId: z.string().regex(/^\d{1,20}$/), storefront: z.string().regex(/^[A-Z]{2}$/),
  artistName: z.string().min(1).max(1000), albumName: z.string().min(1).max(1000), trackCount: z.number().int().min(1).max(80),
  releaseDate: z.string().max(100).nullable(), sourceUrl: z.string().refine((value) => catalogURL(value) === value), artworkUrl: z.string().refine((value) => catalogURL(value) === value).nullable(), fetchedAt: z.string().datetime(),
  explicitness: z.enum(["explicit", "cleaned", "notExplicit"]).nullable().optional(),
});
export const albumTrackEditionSchema = editionSummarySchema.extend({ trackId: z.string().regex(/^\d{1,20}$/), disc: z.number().int().min(1).max(8), number: z.number().int().min(1).max(80) });
export type EditionSummary = z.infer<typeof editionSummarySchema>;
export interface EditionTrack { trackId: string; artistName: string; trackName: string; disc: number; number: number; durationMs: number | null; previewUrl: string | null; sourceUrl: string | null }
export interface AlbumEdition { album: EditionSummary; tracks: EditionTrack[] }
export interface AlbumEditionProvider {
  searchEditions(artist: string, album: string): Promise<EditionSummary[]>;
  lookupEdition(id: string): Promise<AlbumEdition | null>;
}
export function catalogURL(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && !url.port
    && ["apple.com", "mzstatic.com"].some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.href : null; } catch { return null; }
}

export function catalogTrackURL(value: unknown, trackId: string, collectionId?: string): string | null {
  const url = catalogURL(value);
  if (!url || !/^\d{1,20}$/.test(trackId)) return null;
  const parsed = new URL(url);
  if (!/^(music|itunes|geo\.music)\.apple\.com$/.test(parsed.hostname)) return null;
  const albumId = parsed.pathname.match(/\/album\/(?:[^/]+\/)?(\d+)\/?$/)?.[1];
  if (albumId) {
    const trackIds = parsed.searchParams.getAll("i");
    return trackIds.length === 1 && trackIds[0] === trackId && (!collectionId || albumId === collectionId) ? url : null;
  }
  const songId = parsed.pathname.match(/\/song\/(?:[^/]+\/)?(\d+)\/?$/)?.[1];
  return !collectionId && songId === trackId && !parsed.searchParams.has("i") ? url : null;
}
const collection = z.object({ wrapperType: z.literal("collection"), collectionId: z.number().int().positive().safe(),
  artistName: z.string().min(1).max(1000), collectionName: z.string().min(1).max(1000), trackCount: z.number().int().min(1).max(80),
  releaseDate: z.string().max(100).optional(), collectionExplicitness: z.enum(["explicit", "cleaned", "notExplicit"]).optional(), collectionViewUrl: z.string().optional(), artworkUrl100: z.string().optional() });
const song = z.object({ wrapperType: z.literal("track"), kind: z.literal("song"), trackId: z.number().int().positive().safe(),
  collectionId: z.number().int().positive().safe(), collectionName: z.string(), artistName: z.string().min(1).max(1000), trackName: z.string().min(1).max(1000),
  discNumber: z.number().int().min(1).max(8), discCount: z.number().int().min(1).max(8), trackNumber: z.number().int().min(1).max(80),
  trackTimeMillis: z.number().int().positive().optional(), previewUrl: z.string().optional(), trackViewUrl: z.string().optional() });
export function parseEdition(value: unknown, storefront: string, fetchedAt: string): EditionSummary | null {
  const parsed = collection.safeParse(value); if (!parsed.success) return null; const item = parsed.data;
  const sourceUrl = catalogURL(item.collectionViewUrl); if (!sourceUrl) return null;
  const summary = editionSummarySchema.safeParse({ provider: "itunes", collectionId: String(item.collectionId), storefront, artistName: item.artistName,
    albumName: item.collectionName, trackCount: item.trackCount, releaseDate: item.releaseDate ?? null, sourceUrl,
    artworkUrl: catalogURL(item.artworkUrl100)?.replace(/\d+x\d+bb(?=\.)/, "600x600bb") ?? null, fetchedAt, explicitness: item.collectionExplicitness ?? null });
  return summary.success ? summary.data : null;
}
export function parseAlbumEdition(results: unknown[], id: string, storefront: string, fetchedAt: string): AlbumEdition | null {
  const albums = results.map((row) => parseEdition(row, storefront, fetchedAt)).filter((row): row is EditionSummary => Boolean(row && row.collectionId === id));
  if (albums.length !== 1) return null; const album = albums[0];
  const raw = results.filter((row) => row && typeof row === "object" && "wrapperType" in row && row.wrapperType === "track");
  if (raw.length !== album.trackCount) return null;
  const parsed = raw.map((row) => song.safeParse(row)); if (parsed.some((row) => !row.success)) return null;
  const songs = parsed.flatMap((row) => row.success ? [row.data] : []);
  if (songs.some((row) => String(row.collectionId) !== id || !sameRecordingText(row.collectionName, album.albumName))) return null;
  if (new Set(songs.map((row) => row.trackId)).size !== songs.length) return null;
  const ordered = songs.slice().sort((a, b) => a.discNumber - b.discNumber || a.trackNumber - b.trackNumber);
  const discs = Math.max(...ordered.map((row) => row.discNumber));
  if (ordered.some((row) => row.discCount !== discs)) return null;
  for (let disc = 1; disc <= discs; disc++) {
    const rows = ordered.filter((row) => row.discNumber === disc);
    if (!rows.length || rows.some((row, index) => row.trackNumber !== index + 1)) return null;
  }
  return { album, tracks: ordered.map((row) => ({ trackId: String(row.trackId), artistName: row.artistName, trackName: row.trackName,
    disc: row.discNumber, number: row.trackNumber, durationMs: row.trackTimeMillis ?? null, previewUrl: catalogURL(row.previewUrl), sourceUrl: catalogURL(row.trackViewUrl) })) };
}
