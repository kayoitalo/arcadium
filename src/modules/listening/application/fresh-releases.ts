import { prisma } from "@/lib/db/prisma";
import { normalizeText } from "../domain/normalization";
import { itunesArtwork, matchFreshReleases, type FeedRelease, type FreshRelease, type ItunesAlbum } from "../domain/fresh-releases";

/** Duas semanas de lançamentos do site todo (~1,6 a 2,2 MB): o bastante pra "saiu agora". */
const FEED_DAYS = 14;
/** O feed muda devagar: seis horas na memória do servidor. */
const FEED_REVALIDATE_S = 6 * 60 * 60;
/** Só conta quem a pessoa ouviu de verdade no último ano. */
const MIN_PLAYS = 10;

/*
 * O feed passa de 2 MB em semana cheia, e o cache de dados do Next recusa
 * item desse tamanho (baixava de novo a cada visita). Fica na memória do
 * servidor, já reduzido aos campos que o cruzamento usa.
 */
let feedCache: { at: number; releases: FeedRelease[] } | null = null;
let feedLoading: Promise<FeedRelease[]> | null = null;

async function fetchFeed(): Promise<FeedRelease[]> {
  const params = new URLSearchParams({ days: String(FEED_DAYS), past: "true", future: "false" });
  const response = await fetch(`https://api.listenbrainz.org/1/explore/fresh-releases/?${params}`, {
    headers: { "User-Agent": process.env.LISTENBRAINZ_USER_AGENT || "Arcadium/0.1" },
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`ListenBrainz respondeu ${response.status}`);
  const payload = (await response.json()) as { payload?: { releases?: FeedRelease[] } };
  return (payload.payload?.releases ?? []).map((release) => ({
    artist_credit_name: release.artist_credit_name, artist_mbids: release.artist_mbids, release_name: release.release_name,
    release_date: release.release_date, release_group_mbid: release.release_group_mbid, release_group_primary_type: release.release_group_primary_type,
    release_mbid: release.release_mbid, caa_id: release.caa_id, caa_release_mbid: release.caa_release_mbid,
  }));
}

async function loadFeed(now = Date.now()): Promise<FeedRelease[]> {
  if (feedCache && now - feedCache.at < FEED_REVALIDATE_S * 1000) return feedCache.releases;
  // duas visitas ao mesmo tempo esperam o mesmo download
  feedLoading ??= fetchFeed()
    .then((releases) => { feedCache = { at: Date.now(), releases }; return releases; })
    .finally(() => { feedLoading = null; });
  return feedLoading;
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
