import { prisma } from "@/lib/db/prisma";
import { normalizeText } from "../domain/normalization";
import { itunesArtwork, matchFreshReleases, type FeedRelease, type FreshRelease, type ItunesAlbum } from "../domain/fresh-releases";

/** Duas semanas: o feed do site todo nesse recorte tem ~1,6 MB, abaixo do teto de 2 MB do cache do Next. */
const FEED_DAYS = 14;
/** O feed muda devagar: seis horas no cache de dados, compartilhado entre as funções. */
const FEED_REVALIDATE_S = 6 * 60 * 60;
/** Só conta quem a pessoa ouviu de verdade no último ano. */
const MIN_PLAYS = 10;

async function loadFeed(): Promise<FeedRelease[]> {
  const params = new URLSearchParams({ days: String(FEED_DAYS), past: "true", future: "false" });
  const response = await fetch(`https://api.listenbrainz.org/1/explore/fresh-releases/?${params}`, {
    headers: { "User-Agent": process.env.LISTENBRAINZ_USER_AGENT || "Arcadium/0.1" },
    signal: AbortSignal.timeout(8_000),
    next: { revalidate: FEED_REVALIDATE_S },
  });
  if (!response.ok) throw new Error(`ListenBrainz respondeu ${response.status}`);
  const payload = (await response.json()) as { payload?: { releases?: FeedRelease[] } };
  return payload.payload?.releases ?? [];
}

/** O que saiu nas últimas duas semanas de quem a pessoa ouve. Falhou o feed: lista vazia, a tela só não mostra. */
export async function loadFreshReleases(userId: string, now = new Date()): Promise<FreshRelease[]> {
  const since = new Date(now.getTime() - 365 * 86_400_000);
  const [feed, rows] = await Promise.all([
    loadFeed().catch(() => [] as FeedRelease[]),
    prisma.$queryRaw<Array<{ name: string; plays: number }>>`
      SELECT "rawArtistName" AS name, COUNT(*)::int AS plays
      FROM "ListeningEvent"
      WHERE "userId" = ${userId} AND "playedAt" >= ${since}
      GROUP BY 1 HAVING COUNT(*) >= ${MIN_PLAYS}
      ORDER BY 2 DESC LIMIT 400`,
  ]);
  if (feed.length === 0 || rows.length === 0) return [];
  const known = await prisma.artist.findMany({
    where: { normalizedName: { in: rows.map((row) => normalizeText(row.name)) }, mbid: { not: null } },
    select: { normalizedName: true, mbid: true },
  });
  // nome repetido entre artistas diferentes não decide MBID nenhum
  const mbids = new Map<string, string | null>();
  for (const artist of known) mbids.set(artist.normalizedName, mbids.has(artist.normalizedName) ? null : artist.mbid);
  const artists = rows.map((row) => ({ name: row.name, plays: Number(row.plays), mbid: mbids.get(normalizeText(row.name)) ?? null }));
  const found = matchFreshReleases(feed, artists);
  // a capa da loja primeiro: a miniatura do Cover Art Archive costuma faltar nos primeiros dias
  const covers = await Promise.all(found.map((release) => storeCover(release).catch(() => null)));
  return found.map((release, index) => ({ ...release, coverUrl: covers[index] ?? release.coverUrl }));
}

const covers = new Map<string, { at: number; url: string | null }>();
const COVER_TTL_MS = 6 * 60 * 60 * 1000;

/** A capa do disco na busca do iTunes, guardada por seis horas. */
async function storeCover(release: FreshRelease): Promise<string | null> {
  const key = `${release.artist}|${release.title}|${release.date}`;
  const hit = covers.get(key);
  if (hit && Date.now() - hit.at < COVER_TTL_MS) return hit.url;
  const params = new URLSearchParams({ term: `${release.artist} ${release.title}`, entity: "album", limit: "5" });
  const response = await fetch(`https://itunes.apple.com/search?${params}`, { signal: AbortSignal.timeout(3_000), cache: "no-store" });
  if (!response.ok) return null;
  const url = itunesArtwork(((await response.json()) as { results?: ItunesAlbum[] }).results ?? [], release);
  covers.set(key, { at: Date.now(), url });
  return url;
}
