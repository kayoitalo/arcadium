import { z } from "zod";
import type { AlbumCoverFallbackProvider, CoverArtResult } from "../domain/cover-art-provider.interface";

const responseSchema = z.object({
  results: z
    .array(
      z.object({
        artistName: z.string().optional(),
        collectionName: z.string().optional(),
        artworkUrl100: z.string().optional(),
      }),
    )
    .default([]),
});

/** Sufixos de edição que não mudam a capa: "(Deluxe)", "- Single", "Remastered"… */
const EDITION_WORDS =
  /\b(deluxe|expanded|edition|remaster(ed)?|anniversary|version|edited|explicit|clean|bonus|tracks?)\b/g;

/**
 * Reduz um título ao que identifica o disco: sem acento, sem parênteses
 * nem colchetes, sem "- Single" e sem as palavras de edição.
 */
export function normalizeTitle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/\s-\s(single|ep)\b.*$/g, " ")
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
 * O mesmo disco, tolerando a edição: "Meet the Woo 2" casa com "Meet The
 * Woo 2 (Deluxe)". Igualdade estrita depois de normalizar — casar por
 * prefixo trocaria "Meet the Woo 2" por "Meet The Woo", que é outro disco.
 */
export function sameAlbum(expected: string, found: string): boolean {
  const a = normalizeTitle(expected);
  return Boolean(a) && a === normalizeTitle(found);
}

/**
 * Terceira fonte de capa, depois do Cover Art Archive e do Last.fm: a
 * busca de catálogo da Apple, pública e sem chave. Ela cobre justamente
 * os álbuns que nunca ganharam vínculo no MusicBrainz.
 *
 * O artwork vem em 100px; trocar o tamanho no nome do arquivo é um
 * truque conhecido do CDN deles e devolve 600px.
 */
export class ItunesCoverAdapter implements AlbumCoverFallbackProvider {
  private baseUrl = "https://itunes.apple.com/search";

  async findAlbumCover(artistName: string, albumName: string): Promise<CoverArtResult | null> {
    if (!artistName.trim() || !albumName.trim()) return null;

    // "(feat. Fulano)" no termo atrapalha a busca deles; sai antes de perguntar
    const cleanAlbum = albumName.replace(/\(.*?\)|\[.*?\]/g, " ").replace(/\s+/g, " ").trim() || albumName;
    const query = new URLSearchParams({ term: `${artistName} ${cleanAlbum}`, entity: "album", limit: "10" });

    const response = await fetch(`${this.baseUrl}?${query}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`iTunes album search returned HTTP ${response.status}`);

    const parsed = responseSchema.safeParse(await response.json());
    if (!parsed.success) return null;

    const candidates = parsed.data.results.filter(
      (result) =>
        result.artworkUrl100 &&
        result.artistName &&
        result.collectionName &&
        sameArtist(artistName, result.artistName) &&
        sameAlbum(albumName, result.collectionName),
    );

    // os dois casam depois de normalizar; o título escrito igual ganha da edição deluxe
    const wanted = albumName.trim().toLowerCase();
    const exact = candidates.find((result) => result.collectionName!.trim().toLowerCase() === wanted);
    const chosen = exact ?? candidates[0];
    if (!chosen?.artworkUrl100) return null;

    return {
      url: chosen.artworkUrl100.replace(/\/\d+x\d+bb\./, "/600x600bb."),
      source: "itunes",
      entityType: "release",
      mbid: "",
    };
  }
}
