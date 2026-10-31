import { ItunesCatalogAdapter } from "@/modules/enrichment/infrastructure/itunes-catalog-adapter";
import type { PreviewProvider, TrackPreview } from "../domain/preview-provider.interface";

interface CacheEntry {
  value: TrackPreview | null;
  expiresAt: number;
}

/** O catálogo não muda de hora em hora; uma sessão inteira reusa o mesmo lote. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<TrackPreview | null>>();

function cacheKey(storefront: string, artistName: string, trackName: string): string {
  return JSON.stringify([storefront, artistName.toLowerCase(), trackName.toLowerCase()]);
}

/**
 * Prévia de 30s de uma sugestão, pelo catálogo da Apple. Exige o mesmo
 * artista e o mesmo título — tocar outra música com o nome desta no
 * cartão seria pior do que não tocar nada. Compartilha a fila do catálogo.
 */
export class ItunesPreviewAdapter implements PreviewProvider {
  constructor(private catalog = new ItunesCatalogAdapter()) {}

  async findPreview(artistName: string, trackName: string): Promise<TrackPreview | null> {
    if (!artistName.trim() || !trackName.trim()) return null;

    const key = cacheKey(this.catalog.storefront, artistName, trackName);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const pending = inFlight.get(key);
    if (pending) return pending;
    const request = this.lookup(key, artistName, trackName);
    inFlight.set(key, request);
    try { return await request; }
    finally { inFlight.delete(key); }
  }

  private async lookup(key: string, artistName: string, trackName: string): Promise<TrackPreview | null> {
    let result: TrackPreview | null = null;

    try {
      const track = await this.catalog.searchTrack(artistName, trackName);
      if (track?.previewUrl) {
        result = {
          url: track.previewUrl,
          artworkUrl: track.artworkUrl ?? undefined,
          appleMusicUrl: track.appleMusicUrl ?? undefined,
          identity: {
            source: "itunes", sourceId: track.trackId,
            artistName: track.artistName, trackName: track.name,
            match: "compatible-text-v1",
          },
        };
      }
    } catch (error) {
      // prévia é bônus: sem ela o cartão ainda funciona
      console.warn(
        `[ItunesPreview] falhou para "${artistName} - ${trackName}":`,
        error instanceof Error ? error.message : error,
      );
      // Falha temporária não é ausência de prévia por 24 horas.
      throw error;
    }

    cache.set(key, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }
}
