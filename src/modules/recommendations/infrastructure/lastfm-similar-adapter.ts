import { z } from "zod";
import type {
  ArtistReach,
  ExternalTrack,
  SimilarArtist,
  SimilarArtistProvider,
} from "../domain/similar-artist-provider.interface";

const similarArtistsSchema = z.object({
  similarartists: z.object({
    artist: z
      .array(
        z.object({
          name: z.string(),
          match: z.union([z.string(), z.number()]).optional(),
        }),
      )
      .default([]),
  }),
});

const topTracksSchema = z.object({
  toptracks: z.object({
    track: z
      .array(
        z.object({
          name: z.string(),
          artist: z.object({ name: z.string() }),
        }),
      )
      .default([]),
  }),
});

const artistInfoSchema = z.object({
  artist: z
    .object({ stats: z.object({ listeners: z.union([z.string(), z.number()]) }).optional() })
    .optional(),
});

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/** Uma sessão é gerada a cada troca de modo; sem cache isso vira uma rajada de chamadas. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry<unknown>>();

function readCache<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache<T>(key: string, value: T): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export class LastFmSimilarArtistProvider implements SimilarArtistProvider {
  private apiKey: string;
  private userAgent: string;
  private baseUrl = "https://ws.audioscrobbler.com/2.0/";

  constructor(apiKey?: string, userAgent?: string) {
    this.apiKey = apiKey ?? process.env.LASTFM_API_KEY ?? "";
    this.userAgent = userAgent ?? process.env.LASTFM_USER_AGENT ?? "Grooveyard/0.1";
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  async getSimilarArtists(artistName: string, limit: number): Promise<SimilarArtist[]> {
    const cacheKey = `similar:${artistName.toLowerCase()}:${limit}`;
    const cached = readCache<SimilarArtist[]>(cacheKey);
    if (cached) return cached;

    const payload = await this.request(
      { method: "artist.getsimilar", artist: artistName, limit: String(limit) },
      similarArtistsSchema,
    );
    if (!payload) return [];

    const artists = payload.similarartists.artist
      .map((entry) => ({
        name: entry.name.trim(),
        match: Math.min(1, Math.max(0, Number(entry.match ?? 0) || 0)),
      }))
      .filter((entry) => entry.name.length > 0);

    writeCache(cacheKey, artists);
    return artists;
  }

  async getTopTracks(artistName: string, limit: number): Promise<ExternalTrack[]> {
    const cacheKey = `toptracks:${artistName.toLowerCase()}:${limit}`;
    const cached = readCache<ExternalTrack[]>(cacheKey);
    if (cached) return cached;

    const payload = await this.request(
      { method: "artist.gettoptracks", artist: artistName, limit: String(limit) },
      topTracksSchema,
    );
    if (!payload) return [];

    const tracks = payload.toptracks.track
      .map((entry) => ({
        artistName: entry.artist.name.trim(),
        trackName: entry.name.trim(),
      }))
      .filter((entry) => entry.artistName.length > 0 && entry.trackName.length > 0);

    writeCache(cacheKey, tracks);
    return tracks;
  }

  /**
   * Ouvintes únicos do artista. É o proxy de fama que sustenta as duas
   * pontas do que a pessoa pede: o "como eu nunca ouvi isso" (muita gente
   * ouve, você não) e o "sair da bolha" (quase ninguém ouve).
   *
   * Fama não é qualidade — é só o tamanho da plateia.
   */
  async getArtistReach(artistName: string): Promise<ArtistReach | null> {
    const cacheKey = `reach:${artistName.toLowerCase()}`;
    const cached = readCache<ArtistReach | null>(cacheKey);
    if (cached !== null) return cached;

    const payload = await this.request(
      { method: "artist.getinfo", artist: artistName },
      artistInfoSchema,
    );

    const listeners = Number(payload?.artist?.stats?.listeners ?? 0);
    const reach = Number.isFinite(listeners) && listeners > 0 ? { listeners } : null;

    writeCache(cacheKey, reach);
    return reach;
  }

  /**
   * Uma tentativa só, com teto de tempo. Recomendação é conteúdo
   * secundário: se o provedor está lento, é melhor entregar a sessão
   * com as fontes locais do que segurar a página.
   */
  private async request<T>(
    params: Record<string, string>,
    schema: z.ZodType<T>,
  ): Promise<T | null> {
    if (!this.isConfigured()) return null;

    const query = new URLSearchParams({
      ...params,
      api_key: this.apiKey,
      format: "json",
      autocorrect: "1",
    });

    try {
      const response = await fetch(`${this.baseUrl}?${query}`, {
        headers: { "User-Agent": this.userAgent },
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) {
        console.warn(`[LastFmSimilar] ${params.method} devolveu HTTP ${response.status}`);
        return null;
      }

      const parsed = schema.safeParse(await response.json());
      if (!parsed.success) {
        console.warn(`[LastFmSimilar] resposta inesperada em ${params.method}`);
        return null;
      }

      return parsed.data;
    } catch (error) {
      console.warn(`[LastFmSimilar] ${params.method} falhou:`, error instanceof Error ? error.message : error);
      return null;
    }
  }
}
