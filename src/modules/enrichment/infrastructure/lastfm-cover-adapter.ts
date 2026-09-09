import { z } from "zod";
import type { AlbumCoverFallbackProvider, CoverArtResult, TrackCoverProvider } from "../domain/cover-art-provider.interface";

const imageListSchema = z.array(z.object({ "#text": z.string(), size: z.string() }));

const responseSchema = z.object({
  album: z.object({ image: imageListSchema }).optional(),
  error: z.number().optional(),
});

const trackResponseSchema = z.object({
  track: z.object({ album: z.object({ image: imageListSchema }).optional() }).optional(),
  error: z.number().optional(),
});

/** A maior imagem disponível; Last.fm devolve as menores primeiro. */
function pickLargest(images: z.infer<typeof imageListSchema>): string | null {
  const usable = images.filter((image) => image["#text"]);
  const chosen =
    usable.find((image) => image.size === "mega") ??
    usable.find((image) => image.size === "extralarge") ??
    usable.at(-1);
  return chosen?.["#text"] ?? null;
}

export class LastFmCoverAdapter implements AlbumCoverFallbackProvider, TrackCoverProvider {
  constructor(private apiKey = process.env.LASTFM_API_KEY || "", private userAgent = process.env.LASTFM_USER_AGENT || "Grooveyard/0.1") {}

  async findAlbumCover(artistName: string, albumName: string): Promise<CoverArtResult | null> {
    if (!this.apiKey || !artistName.trim() || !albumName.trim()) return null;
    const params = new URLSearchParams({ method: "album.getinfo", api_key: this.apiKey, artist: artistName, album: albumName, autocorrect: "1", format: "json" });
    const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`, { headers: { "User-Agent": this.userAgent }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`Last.fm album artwork returned HTTP ${response.status}`);
    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success || !parsed.data.album) return null;
    const url = pickLargest(parsed.data.album.image);
    if (!url) return null;
    return { url, source: "lastfm", entityType: "release", mbid: "" };
  }

  /**
   * Degrada em silêncio: uma sugestão sem capa cai no desenho de bolacha
   * em branco, o que é melhor do que derrubar a sessão inteira.
   */
  async findTrackCover(artistName: string, trackName: string): Promise<CoverArtResult | null> {
    if (!this.apiKey || !artistName.trim() || !trackName.trim()) return null;

    const params = new URLSearchParams({
      method: "track.getinfo",
      api_key: this.apiKey,
      artist: artistName,
      track: trackName,
      autocorrect: "1",
      format: "json",
    });

    try {
      const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`, {
        headers: { "User-Agent": this.userAgent },
        signal: AbortSignal.timeout(6_000),
      });
      if (!response.ok) return null;

      const parsed = trackResponseSchema.safeParse(await response.json());
      const images = parsed.success ? parsed.data.track?.album?.image : undefined;
      if (!images) return null;

      const url = pickLargest(images);
      return url ? { url, source: "lastfm", entityType: "release", mbid: "" } : null;
    } catch {
      return null;
    }
  }
}
