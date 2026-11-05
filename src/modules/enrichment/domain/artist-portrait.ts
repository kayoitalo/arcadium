import { z } from "zod";

export function portraitImageURL(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "i.scdn.co"
      && !url.port && !url.username && !url.password && /^\/image\/[a-zA-Z0-9]+$/.test(url.pathname)
      ? url.href : null;
  } catch { return null; }
}

export const spotifyArtistIdSchema = z.string().regex(/^[a-zA-Z0-9]{22}$/);
const spotifyPhotoSchema = z.object({
  status: z.literal("READY"), provider: z.literal("spotify"), artistId: spotifyArtistIdSchema,
  artistName: z.string().min(1).max(500),
  imageUrl: z.string().refine(value => portraitImageURL(value) === value),
  sourceUrl: z.string().regex(/^https:\/\/open\.spotify\.com\/artist\/[a-zA-Z0-9]{22}$/),
  checkedAt: z.string().datetime(),
}).refine(photo => photo.sourceUrl === `https://open.spotify.com/artist/${photo.artistId}`);

export function lastfmPortraitImageURL(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    if (url.protocol === "http:") url.protocol = "https:";
    return url.protocol === "https:" && ["lastfm-img.freetls.fastly.net", "lastfm.freetls.fastly.net"].includes(url.hostname)
      && !url.port && !url.username && !url.password && url.pathname.startsWith("/i/u/")
      && /\.(?:jpe?g|png|webp)$/i.test(url.pathname) && !url.pathname.includes("2a96cbd8b46e442fc41c2b86b821562f") ? url.href : null;
  } catch { return null; }
}
export function lastfmArtistPageURL(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value); if (url.protocol === "http:") url.protocol = "https:";
    return url.protocol === "https:" && url.hostname === "www.last.fm" && !url.port && !url.username && !url.password
      && /^\/music\/[^/]+\/?$/.test(url.pathname) && !url.search && !url.hash ? url.href : null;
  } catch { return null; }
}
export const lastfmArtistProfileSchema = z.object({ provider: z.literal("lastfm"), artistName: z.string().min(1).max(500), sourceUrl: z.string().refine(value => lastfmArtistPageURL(value) === value) });
const lastfmPhotoSchema = lastfmArtistProfileSchema.extend({ status: z.literal("READY"), checkedAt: z.string().datetime(), imageUrl: z.string().refine(value => lastfmPortraitImageURL(value) === value) });
export const artistPhotoSchema = z.union([spotifyPhotoSchema, lastfmPhotoSchema]);
export const artistPhotoResultSchema = z.union([artistPhotoSchema,
  z.object({ status: z.literal("MISSING"), reason: z.enum(["NOT_CONFIGURED", "NO_REFERENCE", "NO_MATCH", "AMBIGUOUS", "NO_IMAGE", "PLACEHOLDER"]), profile: lastfmArtistProfileSchema.optional() }),
]);
export type ArtistPhoto = z.infer<typeof artistPhotoSchema>;
export type ArtistPhotoResult = z.infer<typeof artistPhotoResultSchema>;
export interface ArtistPortraitReference { artistName: string; trackName: string }
export interface ArtistPortraitProvider { lookup(reference: ArtistPortraitReference): Promise<ArtistPhotoResult> }
