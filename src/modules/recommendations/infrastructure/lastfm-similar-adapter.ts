import { z } from "zod";
import { sameRecordingText } from "@/lib/music/recording-match";
import { artistPhotoSchema, lastfmArtistPageURL, lastfmPortraitImageURL, type ArtistPhotoResult } from "@/modules/enrichment/domain/artist-portrait";
import type {
  ArtistReach,
  ExternalTrack,
  SimilarArtist,
  SimilarArtistProvider,
  SimilarTrack,
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
const similarTracksSchema = z.object({ similartracks: z.object({ track: z.array(z.object({
  name: z.string(), artist: z.object({ name: z.string() }),
  match: z.union([z.string(), z.number()]).optional(),
})).default([]) }) });
let requestQueue: Promise<unknown> = Promise.resolve();
let lastRequestAt = 0;
let unavailableUntil = 0;
const pending = new Map<string, Promise<unknown>>();
const portraitCache = new Map<string, { value: ArtistPhotoResult; expires: number }>();
const portraitInfoSchema = z.object({ artist: z.object({ name: z.string(), url: z.string(), image: z.array(z.object({ "#text": z.string(), size: z.string() })).max(20).default([]) }) });

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
  private diagnostics = { externalAttempts: 0, cacheHits: 0, failures: 0, coalesced: 0, skippedAfterFailure: 0, deadlineStops: 0 };
  private deadline = Infinity;
  beginDiscoveryWindow(durationMs: number) { this.deadline = Date.now() + Math.max(0, durationMs); }
  getDiagnostics() { return { ...this.diagnostics }; }
  private apiKey: string;
  private userAgent: string;
  private baseUrl = "https://ws.audioscrobbler.com/2.0/";

  constructor(apiKey?: string, userAgent?: string, private timing: { minIntervalMs?: number } = {}) {
    this.apiKey = apiKey ?? process.env.LASTFM_API_KEY ?? "";
    this.userAgent = userAgent ?? process.env.LASTFM_USER_AGENT ?? "Arcadium/0.1";
  }

  async getSimilarTracks(artistName: string, trackName: string, limit: number): Promise<SimilarTrack[]> {
    const key = JSON.stringify(["similartracks", artistName.toLowerCase(), trackName.toLowerCase(), limit]);
    const cached = readCache<SimilarTrack[]>(key);
    if (cached) { this.diagnostics.cacheHits++; return cached; }
    const payload = await this.request({ method: "track.getsimilar", artist: artistName, track: trackName,
      limit: String(Math.min(20, Math.max(1, limit))), autocorrect: "0" }, similarTracksSchema);
    if (!payload) return [];
    const tracks = payload.similartracks.track.map((track, index) => {
      const raw = track.match === undefined ? undefined : Number(track.match);
      return { artistName: track.artist.name.trim(), trackName: track.name.trim(), rank: index + 1,
        rawMatch: raw !== undefined && Number.isFinite(raw) && raw >= 0 ? raw : undefined };
    }).filter((track) => track.artistName && track.trackName);
    writeCache(key, tracks);
    return tracks;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }

  /** Profile/photo uses the same Last.fm queue, cooldown and request coalescing. */
  async getArtistPortrait(artistName: string): Promise<ArtistPhotoResult> {
    if (!this.isConfigured()) return { status: "MISSING", reason: "NOT_CONFIGURED" };
    const cached = portraitCache.get(artistName);
    if (cached && cached.expires > Date.now()) return cached.value;
    const payload = await this.request({ method: "artist.getinfo", artist: artistName, autocorrect: "0" }, portraitInfoSchema, Date.now() + 2500);
    if (!payload) throw new Error("Last.fm portrait temporarily unavailable");
    const artist = payload.artist; const sourceUrl = lastfmArtistPageURL(artist.url);
    let value: ArtistPhotoResult;
    const slug = sourceUrl ? decodeURIComponent(new URL(sourceUrl).pathname.slice(7).replace(/\/$/, "").replace(/\+/g, " ")) : "";
    if (!sourceUrl || !sameRecordingText(artistName, artist.name) || !sameRecordingText(artistName, slug)) value = { status: "MISSING", reason: "AMBIGUOUS" };
    else {
      const profile = { provider: "lastfm" as const, artistName: artist.name, sourceUrl };
      const order = ["small", "medium", "large", "extralarge", "mega"];
      const image = artist.image.map(row => ({ url: lastfmPortraitImageURL(row["#text"]), rank: order.indexOf(row.size) })).filter(row => row.url).sort((a, b) => b.rank - a.rank)[0];
      value = image ? artistPhotoSchema.parse({ ...profile, status: "READY", imageUrl: image.url, checkedAt: new Date().toISOString() })
        : { status: "MISSING", reason: artist.image.some(row => row["#text"].includes("2a96cbd8b46e442fc41c2b86b821562f")) ? "PLACEHOLDER" : "NO_IMAGE", profile };
    }
    portraitCache.delete(artistName); portraitCache.set(artistName, { value, expires: Date.now() + (value.status === "READY" ? 86400000 : 3600000) });
    while (portraitCache.size > 64) portraitCache.delete(portraitCache.keys().next().value!);
    return value;
  }

  async getSimilarArtists(artistName: string, limit: number): Promise<SimilarArtist[]> {
    const cacheKey = `similar:${artistName.toLowerCase()}:${limit}`;
    const cached = readCache<SimilarArtist[]>(cacheKey);
    if (cached) { this.diagnostics.cacheHits++; return cached; }

    const payload = await this.request(
      { method: "artist.getsimilar", artist: artistName, limit: String(limit) },
      similarArtistsSchema,
    );
    if (!payload) return [];

    const artists = payload.similarartists.artist
      .map((entry) => ({
        name: entry.name.trim(),
        match: Math.min(1, Math.max(0, Number(entry.match ?? 0) || 0)),
        ...(entry.match !== undefined && Number.isFinite(Number(entry.match)) ? { rawMatch: Number(entry.match) } : {}),
      }))
      .filter((entry) => entry.name.length > 0);

    writeCache(cacheKey, artists);
    return artists;
  }

  async getTopTracks(artistName: string, limit: number): Promise<ExternalTrack[]> {
    const cacheKey = `toptracks:${artistName.toLowerCase()}:${limit}`;
    const cached = readCache<ExternalTrack[]>(cacheKey);
    if (cached) { this.diagnostics.cacheHits++; return cached; }

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
    if (cached !== null) { this.diagnostics.cacheHits++; return cached; }

    const payload = await this.request(
      { method: "artist.getinfo", artist: artistName },
      artistInfoSchema,
    );

    if (!payload) return null; // Temporary failure is not a cached catalog fact.
    const listeners = Number(payload.artist?.stats?.listeners ?? 0);
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
    deadline = Infinity,
  ): Promise<T | null> {
    if (!this.isConfigured()) return null;
    const key = JSON.stringify(params);
    const existing = pending.get(key) as Promise<T | null> | undefined;
    if (existing) { this.diagnostics.coalesced++; return existing; }
    const task = requestQueue.then(async () => {
      if (Date.now() >= Math.min(this.deadline, deadline)) { this.diagnostics.deadlineStops++; return null; }
      if (unavailableUntil > Date.now() && (this.timing.minIntervalMs ?? 300) > 0) { this.diagnostics.skippedAfterFailure++; return null; }
      const delay = lastRequestAt + (this.timing.minIntervalMs ?? 300) - Date.now();
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      if (Date.now() >= Math.min(this.deadline, deadline)) { this.diagnostics.deadlineStops++; return null; }
      lastRequestAt = Date.now();
      return this.performRequest(params, schema);
    });
    requestQueue = task.catch(() => null);
    pending.set(key, task);
    try { return await task; } finally { pending.delete(key); }
  }

  private async performRequest<T>(params: Record<string, string>, schema: z.ZodType<T>): Promise<T | null> {

    const query = new URLSearchParams({
      ...params,
      api_key: this.apiKey,
      format: "json",
      autocorrect: "1",
      ...(params.autocorrect !== undefined ? { autocorrect: params.autocorrect } : {}),
    });

    try {
      this.diagnostics.externalAttempts++;
      const response = await fetch(`${this.baseUrl}?${query}`, {
        headers: { "User-Agent": this.userAgent },
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) {
        this.diagnostics.failures++;
        if (response.status === 429 || response.status >= 500) {
          const retrySeconds = Number(response.headers?.get("retry-after"));
          unavailableUntil = Date.now() + Math.max(30_000, Number.isFinite(retrySeconds) ? retrySeconds * 1000 : 0);
        }
        console.warn(`[LastFmSimilar] ${params.method} devolveu HTTP ${response.status}`);
        return null;
      }

      const raw = await response.json();
      if (raw && typeof raw.error === "number") {
        this.diagnostics.failures++;
        if ([11, 16, 29].includes(raw.error)) unavailableUntil = Date.now() + 30_000;
        return null;
      }
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        this.diagnostics.failures++;
        console.warn(`[LastFmSimilar] resposta inesperada em ${params.method}`);
        return null;
      }

      return parsed.data;
    } catch (error) {
      this.diagnostics.failures++;
      unavailableUntil = Date.now() + 30_000;
      console.warn(`[LastFmSimilar] ${params.method} falhou`);
      return null;
    }
  }
}
