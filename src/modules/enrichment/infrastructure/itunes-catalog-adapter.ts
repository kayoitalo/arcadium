import { z } from "zod";
import { filterGenreTags } from "../domain/genre-tags";
import type { AlbumCoverFallbackProvider, CoverArtResult } from "../domain/cover-art-provider.interface";

/**
 * O catálogo público da Apple (iTunes Search API): sem chave, sem login.
 * Dele vêm a capa em 600px, a prévia de 30s, a duração exata de cada
 * faixa, o ano de lançamento, um gênero e o link para o Apple Music.
 *
 * A Apple fala em ~20 chamadas por minuto. Toda chamada passa por uma
 * fila compartilhada que respeita esse ritmo; quem precisa de rajada
 * curta (as prévias de uma sessão de descobertas) pede intervalo zero.
 */

/** ~19 chamadas por minuto: abaixo do limite, com folga. */
export const CATALOG_INTERVAL_MS = 3_100;

const albumSchema = z.object({
  wrapperType: z.literal("collection"),
  collectionId: z.number(),
  artistName: z.string(),
  collectionName: z.string(),
  artworkUrl100: z.string().optional(),
  collectionViewUrl: z.string().optional(),
  primaryGenreName: z.string().optional(),
  releaseDate: z.string().optional(),
});

const trackSchema = z.object({
  wrapperType: z.literal("track"),
  kind: z.literal("song"),
  trackId: z.number(),
  artistName: z.string(),
  trackName: z.string(),
  trackTimeMillis: z.number().optional(),
  previewUrl: z.string().optional(),
  trackViewUrl: z.string().optional(),
  artworkUrl100: z.string().optional(),
});

const responseSchema = z.object({ results: z.array(z.unknown()).default([]) });

export interface CatalogAlbum {
  collectionId: string;
  name: string;
  artistName: string;
  artworkUrl: string | null;
  appleMusicUrl: string | null;
  genre: string | null;
  releaseYear: number | null;
}

export interface CatalogTrack {
  trackId: string;
  name: string;
  artistName: string;
  durationMs: number | null;
  previewUrl: string | null;
  appleMusicUrl: string | null;
  artworkUrl: string | null;
}

/* ------------------------------------------------------------------ */
/* casamento de nomes                                                  */
/* ------------------------------------------------------------------ */

/** Sufixos de edição que não mudam o disco: "(Deluxe)", "- Single", "Remastered"… */
const EDITION_WORDS =
  /\b(deluxe|expanded|edition|remaster(ed)?|anniversary|version|edited|explicit|clean|bonus|tracks?)\b/g;

/**
 * Sufixo de edição depois de " - ": "Dreams - 2004 Remaster", "Numb -
 * Live", "Broken Youth - Single". O Last.fm grava assim e o catálogo não,
 * então sem cortar isso a faixa de um disco remasterizado nunca casa.
 * Um hífen que não traz palavra de edição ("Doo-Wop - That Thing") fica.
 */
const EDITION_SUFFIX =
  /\s[-–]\s(?=[^-–]*\b(single|ep|remaster(ed)?|live|mono|stereo|edit|version|mix|deluxe|bonus|acoustic)\b).*$/;

/**
 * Reduz um título ao que identifica o disco ou a faixa: sem acento, sem
 * parênteses nem colchetes, sem sufixo de edição e sem as palavras de edição.
 */
export function normalizeTitle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(EDITION_SUFFIX, " ")
    .replace(EDITION_WORDS, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const tokens = (value: string) => new Set(normalizeTitle(value).split(" ").filter(Boolean));

/**
 * O mesmo artista escrito de jeitos diferentes ("30 Seconds to Mars" e
 * "Thirty Seconds to Mars", "LINKIN PARK"): igual, um contém o outro, ou
 * a maior parte das palavras em comum.
 */
export function sameArtist(expected: string, found: string): boolean {
  const a = normalizeTitle(expected);
  const b = normalizeTitle(found);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;

  const left = tokens(expected);
  const right = tokens(found);
  const shared = [...left].filter((token) => right.has(token)).length;
  return shared / Math.min(left.size, right.size) >= 0.6;
}

/**
 * O mesmo disco ou a mesma faixa, tolerando a edição: "Meet the Woo 2"
 * casa com "Meet The Woo 2 (Deluxe)". Igualdade estrita depois de
 * normalizar — por prefixo, "Meet the Woo 2" viraria "Meet The Woo".
 */
export function sameTitle(expected: string, found: string): boolean {
  const a = normalizeTitle(expected);
  return Boolean(a) && a === normalizeTitle(found);
}

/** Tira "(feat. Fulano)" e afins do termo: atrapalham a busca deles. */
const searchable = (value: string) =>
  value.replace(/\(.*?\)|\[.*?\]/g, " ").replace(/\s+/g, " ").trim() || value;

const upsize = (url?: string) => (url ? url.replace(/\/\d+x\d+bb\./, "/600x600bb.") : null);

/* ------------------------------------------------------------------ */
/* gênero                                                              */
/* ------------------------------------------------------------------ */

/** Os nomes de gênero da Apple que não batem com o vocabulário do app. */
const APPLE_GENRE_ALIASES: Record<string, string> = {
  "hip-hop/rap": "hip hop",
  "hip-hop": "hip hop",
  "r&b/soul": "r&b",
  alternative: "alternative rock",
  "christian & gospel": "gospel",
  christian: "gospel",
  "rock y alternativo": "alternative rock",
};

/**
 * O gênero da Apple no mesmo formato das tags do MusicBrainz, ou null
 * quando ele não diz nada de som ("Singer/Songwriter", "Brazilian",
 * "Children's Music").
 */
export function normalizeAppleGenre(genre?: string | null): string | null {
  if (!genre) return null;
  const lower = genre.trim().toLowerCase();
  return filterGenreTags([APPLE_GENRE_ALIASES[lower] ?? lower])[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* ritmo                                                               */
/* ------------------------------------------------------------------ */

let pacing: Promise<void> = Promise.resolve();
let lastCallAt = 0;

/** Enfileira a chamada e só a solta quando o intervalo mínimo passou. */
function paced<T>(minIntervalMs: number, task: () => Promise<T>): Promise<T> {
  if (minIntervalMs <= 0) return task();

  const turn = pacing.then(async () => {
    const wait = lastCallAt + minIntervalMs - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastCallAt = Date.now();
  });
  pacing = turn.catch(() => undefined);
  return turn.then(task);
}

/* ------------------------------------------------------------------ */
/* adaptador                                                           */
/* ------------------------------------------------------------------ */

export class ItunesCatalogAdapter implements AlbumCoverFallbackProvider {
  constructor(private options: { country?: string; minIntervalMs?: number } = {}) {}

  /** A loja muda o catálogo: há discos que só existem fora da loja americana. */
  private get country(): string {
    return (this.options.country ?? process.env.ITUNES_COUNTRY ?? "BR").toUpperCase();
  }

  private async request(path: "search" | "lookup", params: Record<string, string>): Promise<unknown[]> {
    // lang=en_us: os gêneros vêm em inglês, como as tags do resto do app
    const query = new URLSearchParams({ ...params, country: this.country, lang: "en_us" });

    return paced(this.options.minIntervalMs ?? CATALOG_INTERVAL_MS, async () => {
      const response = await fetch(`https://itunes.apple.com/${path}?${query}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`iTunes ${path} returned HTTP ${response.status}`);
      const parsed = responseSchema.safeParse(await response.json());
      return parsed.success ? parsed.data.results : [];
    });
  }

  /** O disco no catálogo, casando artista e título; null quando não há. */
  async searchAlbum(artistName: string, albumName: string): Promise<CatalogAlbum | null> {
    if (!artistName.trim() || !albumName.trim()) return null;

    const results = await this.request("search", {
      term: `${artistName} ${searchable(albumName)}`,
      entity: "album",
      limit: "10",
    });

    const candidates = results
      .map((result) => albumSchema.safeParse(result))
      .flatMap((parsed) => (parsed.success ? [parsed.data] : []))
      .filter((album) => sameArtist(artistName, album.artistName) && sameTitle(albumName, album.collectionName));

    // os dois casam depois de normalizar; o título escrito igual ganha da edição deluxe
    const wanted = albumName.trim().toLowerCase();
    const chosen = candidates.find((album) => album.collectionName.trim().toLowerCase() === wanted) ?? candidates[0];
    if (!chosen) return null;

    const year = Number(chosen.releaseDate?.slice(0, 4));
    return {
      collectionId: String(chosen.collectionId),
      name: chosen.collectionName,
      artistName: chosen.artistName,
      artworkUrl: upsize(chosen.artworkUrl100),
      appleMusicUrl: chosen.collectionViewUrl ?? null,
      genre: normalizeAppleGenre(chosen.primaryGenreName),
      releaseYear: year >= 1900 && year <= 2100 ? year : null,
    };
  }

  /** Todas as faixas do disco numa chamada só: duração, prévia e link de cada uma. */
  async lookupTracks(collectionId: string): Promise<CatalogTrack[]> {
    const results = await this.request("lookup", { id: collectionId, entity: "song", limit: "200" });
    return results
      .map((result) => trackSchema.safeParse(result))
      .flatMap((parsed) => (parsed.success ? [toCatalogTrack(parsed.data)] : []));
  }

  /**
   * Uma faixa solta — as sugestões de descoberta não têm disco. Exige o
   * mesmo artista e o mesmo título: tocar outra música do artista com o
   * nome desta no cartão seria pior do que não tocar nada.
   */
  async searchTrack(artistName: string, trackName: string): Promise<CatalogTrack | null> {
    if (!artistName.trim() || !trackName.trim()) return null;

    const results = await this.request("search", {
      term: `${artistName} ${searchable(trackName)}`,
      entity: "song",
      limit: "10",
    });

    const match = results
      .map((result) => trackSchema.safeParse(result))
      .flatMap((parsed) => (parsed.success ? [parsed.data] : []))
      .find((track) => sameArtist(artistName, track.artistName) && sameTitle(trackName, track.trackName));

    return match ? toCatalogTrack(match) : null;
  }

  /** Terceira fonte de capa, depois do Cover Art Archive e do Last.fm. */
  async findAlbumCover(artistName: string, albumName: string): Promise<CoverArtResult | null> {
    const album = await this.searchAlbum(artistName, albumName);
    if (!album?.artworkUrl) return null;
    return { url: album.artworkUrl, source: "itunes", entityType: "release", mbid: "" };
  }
}

function toCatalogTrack(track: z.infer<typeof trackSchema>): CatalogTrack {
  return {
    trackId: String(track.trackId),
    name: track.trackName,
    artistName: track.artistName,
    durationMs: track.trackTimeMillis ?? null,
    previewUrl: track.previewUrl ?? null,
    appleMusicUrl: track.trackViewUrl ?? null,
    artworkUrl: upsize(track.artworkUrl100),
  };
}
