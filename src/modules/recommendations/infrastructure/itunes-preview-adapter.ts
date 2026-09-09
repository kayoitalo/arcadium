import { z } from "zod";
import type { PreviewProvider, TrackPreview } from "../domain/preview-provider.interface";

const responseSchema = z.object({
  results: z
    .array(
      z.object({
        previewUrl: z.string().optional(),
        artworkUrl100: z.string().optional(),
        trackName: z.string().optional(),
        artistName: z.string().optional(),
      }),
    )
    .default([]),
});

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
 * Busca de catálogo da Apple: pública, sem chave e sem autenticação.
 *
 * O artwork vem em 100px na resposta; trocar por 600 no nome do arquivo é
 * um truque conhecido do CDN deles e devolve a capa em tamanho utilizável.
 */
export class ItunesPreviewAdapter implements PreviewProvider {
  private baseUrl = "https://itunes.apple.com/search";

  async findPreview(artistName: string, trackName: string): Promise<TrackPreview | null> {
    if (!artistName.trim() || !trackName.trim()) return null;

    const key = cacheKey(artistName, trackName);
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const query = new URLSearchParams({
      term: `${artistName} ${trackName}`,
      entity: "song",
      limit: "1",
    });

    let result: TrackPreview | null = null;

    try {
      const response = await fetch(`${this.baseUrl}?${query}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8000),
      });

      if (response.ok) {
        const parsed = responseSchema.safeParse(await response.json());
        const first = parsed.success ? parsed.data.results[0] : undefined;

        if (first?.previewUrl) {
          result = {
            url: first.previewUrl,
            artworkUrl: first.artworkUrl100?.replace("100x100bb", "600x600bb"),
          };
        }
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
