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

export const artistPhotoSchema = spotifyPhotoSchema;
export const artistPhotoResultSchema = z.discriminatedUnion("status", [artistPhotoSchema,
  z.object({ status: z.literal("MISSING"), reason: z.enum(["NOT_CONFIGURED", "NO_REFERENCE", "NO_MATCH", "AMBIGUOUS", "NO_IMAGE"]) }),
]);
export type ArtistPhoto = z.infer<typeof artistPhotoSchema>;
export type ArtistPhotoResult = z.infer<typeof artistPhotoResultSchema>;
export interface ArtistPortraitReference { artistName: string; trackName: string }
export interface ArtistPortraitProvider { lookup(reference: ArtistPortraitReference): Promise<ArtistPhotoResult> }
