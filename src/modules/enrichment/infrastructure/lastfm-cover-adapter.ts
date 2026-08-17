import { z } from "zod";
import type { AlbumCoverFallbackProvider, CoverArtResult } from "../domain/cover-art-provider.interface";

const responseSchema = z.object({
  album: z.object({ image: z.array(z.object({ "#text": z.string(), size: z.string() })) }).optional(),
  error: z.number().optional(),
});

export class LastFmCoverAdapter implements AlbumCoverFallbackProvider {
  constructor(private apiKey = process.env.LASTFM_API_KEY || "", private userAgent = process.env.LASTFM_USER_AGENT || "SpotStats/0.1.0") {}

  async findAlbumCover(artistName: string, albumName: string): Promise<CoverArtResult | null> {
    if (!this.apiKey || !artistName.trim() || !albumName.trim()) return null;
    const params = new URLSearchParams({ method: "album.getinfo", api_key: this.apiKey, artist: artistName, album: albumName, autocorrect: "1", format: "json" });
    const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`, { headers: { "User-Agent": this.userAgent }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Last.fm album artwork returned HTTP ${response.status}`);
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success || !parsed.data.album) return null;
    const images = parsed.data.album.image.filter((image) => image["#text"]);
    const image = images.find((item) => item.size === "mega") || images.find((item) => item.size === "extralarge") || images.at(-1);
    if (!image) return null;
    return { url: image["#text"], source: "lastfm", entityType: "release", mbid: "" };
  }
}
