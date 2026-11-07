import { prisma } from "@/lib/db/prisma";
import { ItunesCatalogAdapter } from "@/modules/enrichment/infrastructure/itunes-catalog-adapter";
import { ItunesPreviewAdapter } from "@/modules/recommendations/infrastructure/itunes-preview-adapter";

/**
 * Capa de reserva da Conversa. Quando o disco ainda não tem capa salva,
 * busca uma vez no catálogo da Apple — primeiro o disco, depois a faixa — e
 * grava no próprio disco. As próximas visitas leem do banco.
 *
 * Só a imagem: a prévia continua pelo caminho validado da faixa. A busca tem
 * prazo curto para não segurar a tela; se estourar, segue em segundo plano e
 * grava quando chegar. Sem resultado, espera algumas horas antes de tentar de
 * novo nesta instância; o enriquecimento de hora em hora continua tentando.
 */
export type CoverSource = "itunes" | "itunes-track";
export interface CoverFallbackDeps {
  findAlbumCover: (artist: string, album: string) => Promise<string | null>;
  findTrackArtwork: (artist: string, track: string) => Promise<string | null>;
  save: (albumId: string, url: string, source: CoverSource) => Promise<void>;
  timeoutMs?: number;
  missRetryMs?: number;
  now?: () => number;
}

const MAX_MISSES = 500;

export function createCoverFallback(deps: CoverFallbackDeps) {
  const timeoutMs = deps.timeoutMs ?? 2_500;
  const missRetryMs = deps.missRetryMs ?? 6 * 60 * 60 * 1000;
  const now = deps.now ?? Date.now;
  const misses = new Map<string, number>();
  const pending = new Map<string, Promise<string | null>>();

  async function lookup(albumId: string, artist: string, album: string, track: string | null): Promise<string | null> {
    const fromAlbum = await deps.findAlbumCover(artist, album).catch(() => null);
    const found = fromAlbum ? { url: fromAlbum, source: "itunes" as const }
      : track ? await deps.findTrackArtwork(artist, track).then((url) => url ? { url, source: "itunes-track" as const } : null).catch(() => null)
        : null;
    if (!found) {
      if (misses.size >= MAX_MISSES) misses.clear();
      misses.set(albumId, now() + missRetryMs);
      return null;
    }
    await deps.save(albumId, found.url, found.source).catch(() => undefined);
    return found.url;
  }

  return function fallbackCover(albumId: string, artist: string, album: string, track: string | null): Promise<string | null> {
    const retryAt = misses.get(albumId);
    if (retryAt && retryAt > now()) return Promise.resolve(null);
    let request = pending.get(albumId);
    if (!request) {
      request = lookup(albumId, artist, album, track).finally(() => pending.delete(albumId));
      pending.set(albumId, request);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); });
    return Promise.race([request, deadline]).finally(() => clearTimeout(timer));
  };
}

const catalog = new ItunesCatalogAdapter();
const previews = new ItunesPreviewAdapter(catalog);

export const fallbackCover = createCoverFallback({
  findAlbumCover: async (artist, album) => (await catalog.findAlbumCover(artist, album))?.url ?? null,
  findTrackArtwork: async (artist, track) => (await previews.findPreview(artist, track))?.artworkUrl ?? null,
  // só preenche disco ainda sem capa: nunca troca uma capa que o enriquecimento já gravou
  save: async (albumId, url, source) => {
    await prisma.album.updateMany({ where: { id: albumId, coverUrl: null },
      data: { coverUrl: url, coverSource: source, coverEntityType: source === "itunes" ? "release" : "recording" } });
  },
});
