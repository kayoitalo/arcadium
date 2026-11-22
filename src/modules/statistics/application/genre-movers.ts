import { prisma } from "@/lib/db/prisma";
import { loadArtistGenres } from "@/modules/statistics/application/artist-genres";
import { getPeriodRanges, type PeriodKey } from "@/modules/statistics/application/overview-service";

/** Um disco que puxou um gênero pra cima ou pra baixo, com a diferença em audições entre as duas janelas. */
export interface GenreMover {
  album: string;
  artist: string;
  coverUrl: string | null;
  delta: number;
}

export interface GenreMovers {
  rising: { genre: string; albums: GenreMover[] } | null;
  falling: { genre: string; albums: GenreMover[] } | null;
}

/**
 * Quem puxou a mudança: os discos do gênero citado que mais ganharam (ou
 * perderam) audições da janela anterior para a atual. É a prova da prova do
 * "o que mudou": o nome concreto atrás da porcentagem.
 */
export function pickMovers(
  rows: Array<{ album: string; artist: string; coverUrl: string | null; current: number; previous: number }>,
  genresOf: (artist: string) => string[],
  genre: string,
  direction: 1 | -1,
  limit = 2,
): GenreMover[] {
  const wanted = genre.trim().toLowerCase();
  return rows
    .filter((row) => genresOf(row.artist).some((tag) => tag.trim().toLowerCase() === wanted))
    .map((row) => ({ album: row.album, artist: row.artist, coverUrl: row.coverUrl, delta: row.current - row.previous }))
    .filter((row) => row.delta * direction > 0)
    .sort((a, b) => (b.delta - a.delta) * direction || a.album.localeCompare(b.album))
    .slice(0, limit);
}

export async function loadGenreMovers(userId: string, period: PeriodKey, rising: string | null, falling: string | null, now = new Date()): Promise<GenreMovers> {
  const { current, previous } = getPeriodRanges(period, now);
  if (!previous || (!rising && !falling)) return { rising: null, falling: null };
  const rows = await prisma.$queryRaw<Array<{ album: string; artist: string; coverUrl: string | null; current: number; previous: number }>>`
    SELECT e."rawAlbumName" AS album, e."rawArtistName" AS artist, MAX(a."coverUrl") AS "coverUrl",
           COUNT(*) FILTER (WHERE e."playedAt" >= ${current.start})::int AS current,
           COUNT(*) FILTER (WHERE e."playedAt" < ${current.start})::int AS previous
    FROM "ListeningEvent" e LEFT JOIN "Album" a ON a.id = e."albumId"
    WHERE e."userId" = ${userId} AND e."playedAt" >= ${previous.start} AND e."playedAt" < ${current.end} AND e."rawAlbumName" IS NOT NULL
    GROUP BY 1, 2`;
  const genres = await loadArtistGenres([...new Set(rows.map((row) => row.artist))]);
  const of = (artist: string) => genres.get(artist) ?? [];
  const numeric = rows.map((row) => ({ ...row, current: Number(row.current), previous: Number(row.previous) }));
  const up = rising ? pickMovers(numeric, of, rising, 1) : [];
  const down = falling ? pickMovers(numeric, of, falling, -1) : [];
  return {
    rising: rising && up.length > 0 ? { genre: rising, albums: up } : null,
    falling: falling && down.length > 0 ? { genre: falling, albums: down } : null,
  };
}
