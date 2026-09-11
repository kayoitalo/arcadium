import { ItunesCatalogAdapter } from "@/modules/enrichment/infrastructure/itunes-catalog-adapter";
import type { PreviewProvider, TrackPreview } from "../domain/preview-provider.interface";

interface CacheEntry {
  value: TrackPreview | null;
  expiresAt: number;
}

/** O catálogo não muda de hora em hora; uma sessão inteira reusa o mesmo lote. */
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

function cacheKey(artistName: string, trackName: string): string {
  return `${artistName.toLowerCase()}|${trackName.toLowerCase()}`;
}

/**
 * Prévia de 30s de uma sugestão, pelo catálogo da Apple. Exige o mesmo
 * artista e o mesmo título — tocar outra música com o nome desta no
 * cartão seria pior do que não tocar nada. Uma sessão tem ~12 faixas,
 * então aqui vale a rajada curta, sem a fila de ritmo do lote.
 */
export class ItunesPreviewAdapter implements PreviewProvider {
  constructor(private catalog = new ItunesCatalogAdapter({ minIntervalMs: 0 })) {}

  async findPreview(artistName: string, trackName: string): Promise<TrackPreview | null> {
    if (!artistName.trim() || !trackName.trim()) return null;

    const key = cacheKey(artistName, trackName);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    let result: TrackPreview | null = null;

    try {
      const track = await this.catalog.searchTrack(artistName, trackName);
      if (track?.previewUrl) {
        result = {
          url: track.previewUrl,
          artworkUrl: track.artworkUrl ?? undefined,
          appleMusicUrl: track.appleMusicUrl ?? undefined,
        };
      }
    } catch (error) {
      // prévia é bônus: sem ela o cartão ainda funciona
      console.warn(
        `[ItunesPreview] falhou para "${artistName} - ${trackName}":`,
        error instanceof Error ? error.message : error,
      );
    }

    cache.set(key, { value: result, expiresAt: Date.now() + CACHE_TTL_MS });
    return result;
  }
}
