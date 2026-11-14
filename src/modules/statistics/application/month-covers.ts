import { prisma } from "@/lib/db/prisma";
import { localDay, localDayBounds, type MonthCovers } from "@/modules/statistics/domain/month-calendar";

/*
 * O mês em capas: para cada dia do mês corrente, no fuso de quem ouve,
 * quanto tocou e qual foi o disco do dia. É prova, não leitura: só conta
 * e ordena. A cor da tela vem das capas que este serviço entrega.
 */

export async function loadMonthCovers(userId: string, now = new Date()): Promise<MonthCovers> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  let timezone = user?.timezone ?? "America/Sao_Paulo";
  try { new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }); } catch { timezone = "America/Sao_Paulo"; }
  const today = localDay(now, timezone);
  const month = today.slice(0, 7);
  const bounds = localDayBounds(`${month}-01`, timezone)!;

  const rows = await prisma.$queryRaw<Array<{ day: string; plays: number; album: string | null; artist: string | null; coverUrl: string | null }>>`
    WITH heard AS (
      SELECT to_char(("playedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS day,
             "rawAlbumName" AS album, "rawArtistName" AS artist, "albumId"
      FROM "ListeningEvent"
      WHERE "userId" = ${userId} AND "playedAt" >= ${bounds.start} AND "playedAt" <= ${now}
    ), totals AS (
      SELECT day, COUNT(*)::int AS plays FROM heard GROUP BY day
    ), ranked AS (
      SELECT day, album, artist, MIN("albumId") AS "albumId",
             ROW_NUMBER() OVER (PARTITION BY day ORDER BY COUNT(*) DESC, album ASC, artist ASC) AS place
      FROM heard WHERE album IS NOT NULL GROUP BY day, album, artist
    )
    SELECT totals.day, totals.plays, ranked.album, ranked.artist, "Album"."coverUrl" AS "coverUrl"
    FROM totals
    LEFT JOIN ranked ON ranked.day = totals.day AND ranked.place = 1
    LEFT JOIN "Album" ON "Album".id = ranked."albumId"
    ORDER BY totals.day ASC`;

  return {
    month, today, timezone,
    days: rows.filter((row) => row.day.startsWith(month)).map((row) => ({ ...row, plays: Number(row.plays) })),
  };
}
