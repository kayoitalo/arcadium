/*
 * O que acabou de sair de quem a pessoa ouve: o feed de lançamentos do
 * ListenBrainz (o site todo) cruzado com os artistas da escuta. O cruzamento
 * é pelo MBID quando o artista tem; sem ele, pelo nome — o crédito inteiro
 * ou cada nome de um crédito composto ("A & B", "A feat. B").
 */

import { normalizeText } from "./normalization";

/** Uma linha do feed /1/explore/fresh-releases, só com o que usamos. */
export interface FeedRelease {
  artist_credit_name: string;
  artist_mbids?: string[];
  release_name: string;
  release_date: string;
  release_group_mbid?: string;
  release_group_primary_type?: string | null;
  release_mbid?: string;
  caa_id?: number | null;
  caa_release_mbid?: string | null;
}

export interface ListenedArtist { name: string; plays: number; mbid?: string | null }

export interface FreshRelease {
  title: string;
  artist: string;
  /** Quem da escuta casou com o crédito, e quanto a pessoa ouviu essa pessoa. */
  matchedArtist: string;
  plays: number;
  date: string;
  kind: "disco" | "EP" | "single" | "outro";
  coverUrl: string | null;
}

const KIND: Record<string, FreshRelease["kind"]> = { album: "disco", ep: "EP", single: "single" };

/** Versão de faixa que já existe (remix de terceiro, acelerada, instrumental) não é lançamento de quem a pessoa ouve. */
const VERSION = /\b(remix(es)?|sped up|slowed|instrumentals?|karaoke|a ?cappella|acapella)\b/i;

/** Os nomes de um crédito: ele inteiro e cada parte. "e"/"and" ficam de fora: dupla sertaneja é um nome só. */
export function creditNames(credit: string): string[] {
  const whole = normalizeText(credit);
  const parts = whole.split(/\s*(?:,|&|\+|\bx\b|\bfeat\.?|\bft\.?|\bfeaturing\b|\bwith\b|\bcom\b)\s*/i).map((part) => part.trim()).filter(Boolean);
  return [...new Set([whole, ...parts])];
}

/** A capa pelo Cover Art Archive, no tamanho de miniatura. */
export function coverOf(release: FeedRelease): string | null {
  const mbid = release.caa_release_mbid ?? release.release_mbid;
  return release.caa_id && mbid ? `https://coverartarchive.org/release/${mbid}/${release.caa_id}-250.jpg` : null;
}

/** Um resultado da busca de discos do iTunes, só com o que a capa precisa. */
export interface ItunesAlbum { collectionName?: string; artistName?: string; releaseDate?: string; artworkUrl100?: string }

/** O título sem o sufixo de formato que a loja põe: "X - EP", "X - Single". */
const bareTitle = (title: string) => normalizeText(title.replace(/\s+-\s+(EP|Single)$/i, ""));

/**
 * A capa do iTunes pra um lançamento novo — a miniatura do Cover Art
 * Archive leva dias pra existir depois do envio. Só vale se for o mesmo
 * disco: título igual, artista do crédito e data a até dez dias.
 */
export function itunesArtwork(results: ItunesAlbum[], release: Pick<FreshRelease, "title" | "artist" | "date">): string | null {
  const title = bareTitle(release.title);
  const names = creditNames(release.artist);
  const day = Date.parse(`${release.date}T12:00:00Z`);
  const match = results.find((album) => album.artworkUrl100 && album.collectionName && bareTitle(album.collectionName) === title
    && names.some((name) => creditNames(album.artistName ?? "").includes(name))
    && (!album.releaseDate || Math.abs(Date.parse(album.releaseDate) - day) <= 10 * 86_400_000));
  return match?.artworkUrl100?.replace(/\/100x100bb\./, "/250x250bb.") ?? null;
}

/**
 * Os lançamentos de quem a pessoa ouve, de quem ela mais ouve pra quem
 * menos; no empate, o mais novo. Um por grupo de lançamento (a edição
 * deluxe e a normal são a mesma coisa) e, por artista, no máximo dois.
 */
export function matchFreshReleases(feed: FeedRelease[], artists: ListenedArtist[], limit = 8): FreshRelease[] {
  const byMbid = new Map<string, ListenedArtist>();
  const byName = new Map<string, ListenedArtist>();
  for (const artist of artists) {
    if (artist.mbid) byMbid.set(artist.mbid, artist);
    const key = normalizeText(artist.name);
    if (!byName.has(key) || byName.get(key)!.plays < artist.plays) byName.set(key, artist);
  }
  const found = new Map<string, FreshRelease>();
  for (const release of feed) {
    const matches = [
      ...(release.artist_mbids ?? []).map((mbid) => byMbid.get(mbid)),
      ...creditNames(release.artist_credit_name).map((name) => byName.get(name)),
    ].filter((artist): artist is ListenedArtist => Boolean(artist));
    if (matches.length === 0 || VERSION.test(release.release_name)) continue;
    const best = matches.reduce((a, b) => (b.plays > a.plays ? b : a));
    const key = release.release_group_mbid ?? `${normalizeText(release.artist_credit_name)}|${normalizeText(release.release_name)}`;
    const entry: FreshRelease = {
      title: release.release_name, artist: release.artist_credit_name, matchedArtist: best.name, plays: best.plays,
      date: release.release_date, kind: KIND[(release.release_group_primary_type ?? "").toLowerCase()] ?? "outro", coverUrl: coverOf(release),
    };
    const previous = found.get(key);
    if (!previous || (!previous.coverUrl && entry.coverUrl)) found.set(key, entry);
  }
  const perArtist = new Map<string, number>();
  return [...found.values()]
    .sort((a, b) => b.plays - a.plays || b.date.localeCompare(a.date) || a.title.localeCompare(b.title))
    .filter((release) => {
      const seen = perArtist.get(release.matchedArtist) ?? 0;
      perArtist.set(release.matchedArtist, seen + 1);
      return seen < 2;
    })
    .slice(0, limit);
}
