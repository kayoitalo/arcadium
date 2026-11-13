import { prisma } from "@/lib/db/prisma";
import { loadArtistGenres } from "@/modules/statistics/application/artist-genres";
import { localDay, localDayBounds } from "@/modules/statistics/domain/month-calendar";
import { buildRace, lastMonths, monthShares, type GenreRace } from "@/modules/statistics/domain/genre-race";

/** Quantos meses a pista mostra: o atual e os cinco anteriores. */
const RACE_MONTHS = 6;

/** A pista dos gêneros nos últimos seis meses, no fuso de quem ouve. */
export async function loadGenreRace(userId: string, now = new Date()): Promise<GenreRace> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  let timezone = user?.timezone ?? "America/Sao_Paulo";
  try { new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }); } catch { timezone = "America/Sao_Paulo"; }
  const months = lastMonths(localDay(now, timezone).slice(0, 7), RACE_MONTHS);
  const start = localDayBounds(`${months[0]}-01`, timezone)!.start;
  const rows = await prisma.$queryRaw<Array<{ month: string; artist: string; plays: number }>>`
    SELECT to_char(("playedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM') AS month,
           "rawArtistName" AS artist, COUNT(*)::int AS plays
    FROM "ListeningEvent"
    WHERE "userId" = ${userId} AND "playedAt" >= ${start} AND "playedAt" <= ${now}
    GROUP BY 1, 2`;
  const genres = await loadArtistGenres(rows.map((row) => row.artist));
  return buildRace(months, monthShares(rows.map((row) => ({ ...row, plays: Number(row.plays) })), (artist) => genres.get(artist) ?? []));
}
