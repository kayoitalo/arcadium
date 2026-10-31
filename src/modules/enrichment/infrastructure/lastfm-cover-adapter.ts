import { z } from "zod";
import { compatibleRecording } from "@/lib/music/recording-match";
import type { AlbumCoverFallbackProvider, CoverArtResult, TrackCoverProvider } from "../domain/cover-art-provider.interface";

const imageListSchema = z.array(z.object({ "#text": z.string(), size: z.string() }));

const responseSchema = z.object({
  album: z.object({ image: imageListSchema }).optional(),
  error: z.number().optional(),
});

const trackResponseSchema = z.object({
  track: z.object({ name: z.string(), artist: z.object({ name: z.string() }), album: z.object({ image: imageListSchema }).optional() }).optional(),
  error: z.number().optional(),
});

const trackCache = new Map<string, { url: string | null; expiresAt: number }>();
const pendingTracks = new Map<string, Promise<CoverArtResult | null>>();
let coverQueue: Promise<unknown> = Promise.resolve();
let nextCoverAt = 0;
let coverUnavailableUntil = 0;

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
  constructor(private apiKey = process.env.LASTFM_API_KEY || "", private userAgent = process.env.LASTFM_USER_AGENT || "Arcadium/0.1") {}

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

    const key = JSON.stringify([this.apiKey, artistName.toLowerCase(), trackName.toLowerCase()]);
    const cached = trackCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.url ? { url: cached.url, source: "lastfm", entityType: "release", mbid: "" } : null;
    const pending = pendingTracks.get(key);
    if (pending) return pending;
    const request = coverQueue.catch(() => undefined).then(async () => {
      if (Date.now() < coverUnavailableUntil) return null;
      const wait = nextCoverAt - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      nextCoverAt = Date.now() + 300;
      return this.lookupTrackCover(artistName, trackName, key);
    });
    coverQueue = request;
    pendingTracks.set(key, request);
    try { return await request; } finally { pendingTracks.delete(key); }
  }

  private async lookupTrackCover(artistName: string, trackName: string, key: string): Promise<CoverArtResult | null> {

    const params = new URLSearchParams({
      method: "track.getinfo",
      api_key: this.apiKey,
      artist: artistName,
      track: trackName,
      autocorrect: "0",
      format: "json",
    });

    try {
      const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`, {
        headers: { "User-Agent": this.userAgent },
        signal: AbortSignal.timeout(6_000),
      });
      if (!response.ok) {
        const retry = Number(response.headers?.get("Retry-After"));
        coverUnavailableUntil = Date.now() + Math.max(30_000, Number.isFinite(retry) ? retry * 1000 : 0);
        return null;
      }

      const parsed = trackResponseSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.error && parsed.data.error !== 6) {
        coverUnavailableUntil = Date.now() + 30_000;
        return null;
      }
      const track = parsed.data.track;
      const matches = track && compatibleRecording({ artistName, trackName }, { artistName: track.artist.name, trackName: track.name });
      const images = matches ? track.album?.image : undefined;

      const url = images ? pickLargest(images) : null;
      trackCache.set(key, { url, expiresAt: Date.now() + (url ? 24 * 60 * 60_000 : 60 * 60_000) });
      return url ? { url, source: "lastfm", entityType: "release", mbid: "" } : null;
    } catch {
      coverUnavailableUntil = Date.now() + 30_000;
      return null;
    }
  }
}
