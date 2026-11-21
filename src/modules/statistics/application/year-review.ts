import { prisma } from "@/lib/db/prisma";
import { localDay, localDayBounds } from "@/modules/statistics/domain/month-calendar";
import { yearChapters, type YearChapter, type YearFacts } from "@/modules/statistics/domain/year-chapters";
import { loadGenreRace } from "@/modules/statistics/application/genre-race";

/*
 * O ano de quem ouve, no fuso dele, medido no banco: totais, o nome que
 * mais voltou, quem chegou, a hora, o mês e o disco. Só conta e ordena.
 */

/** Um mês do ano na fita: quanto tocou e o disco que mais tocou nele. */
export interface YearMonth {
  month: number;
  plays: number;
  album: { name: string; artist: string; coverUrl: string | null } | null;
}

export interface YearReview {
  year: number;
  ongoing: boolean;
  chapters: YearChapter[];
  /** Os meses contados até aqui, de janeiro em diante: a fita do ano. */
  months: YearMonth[];
}

export async function loadYearReview(userId: string, now = new Date()): Promise<YearReview> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  let timezone = user?.timezone ?? "America/Sao_Paulo";
  try { new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }); } catch { timezone = "America/Sao_Paulo"; }
  const year = Number(localDay(now, timezone).slice(0, 4));
  const start = localDayBounds(`${year}-01-01`, timezone)!.start;
  const end = localDayBounds(`${year + 1}-01-01`, timezone)!.start;
  const until = now < end ? now : end;

  const [totals, artists, newcomers, hours, months, albums, monthAlbums] = await prisma.$transaction([
    prisma.$queryRaw<Array<{ plays: number; artists: number }>>`
      SELECT COUNT(*)::int AS plays, COUNT(DISTINCT "rawArtistName")::int AS artists
      FROM "ListeningEvent" WHERE "userId" = ${userId} AND "playedAt" >= ${start} AND "playedAt" < ${until}`,
    prisma.$queryRaw<Array<{ name: string; plays: number }>>`
      SELECT "rawArtistName" AS name, COUNT(*)::int AS plays
      FROM "ListeningEvent" WHERE "userId" = ${userId} AND "playedAt" >= ${start} AND "playedAt" < ${until}
      GROUP BY 1 ORDER BY 2 DESC, 1 ASC LIMIT 1`,
    // quem chegou: a primeira audição de toda a conta caiu dentro deste ano
    prisma.$queryRaw<Array<{ name: string; plays: number; month: number }>>`
      SELECT "rawArtistName" AS name,
             COUNT(*) FILTER (WHERE "playedAt" >= ${start} AND "playedAt" < ${until})::int AS plays,
             EXTRACT(MONTH FROM (MIN("playedAt") AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::int AS month
      FROM "ListeningEvent" WHERE "userId" = ${userId} AND "playedAt" < ${until}
      GROUP BY 1 HAVING MIN("playedAt") >= ${start}
      ORDER BY 2 DESC, 1 ASC LIMIT 2`,
    prisma.$queryRaw<Array<{ hour: number; plays: number }>>`
      SELECT EXTRACT(HOUR FROM ("playedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::int AS hour, COUNT(*)::int AS plays
      FROM "ListeningEvent" WHERE "userId" = ${userId} AND "playedAt" >= ${start} AND "playedAt" < ${until}
      GROUP BY 1 ORDER BY 2 DESC, 1 ASC`,
    prisma.$queryRaw<Array<{ month: number; plays: number }>>`
      SELECT EXTRACT(MONTH FROM ("playedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::int AS month, COUNT(*)::int AS plays
      FROM "ListeningEvent" WHERE "userId" = ${userId} AND "playedAt" >= ${start} AND "playedAt" < ${until}
      GROUP BY 1 ORDER BY 2 DESC, 1 ASC`,
    prisma.$queryRaw<Array<{ name: string; artist: string; plays: number; months: number; coverUrl: string | null }>>`
      SELECT e."rawAlbumName" AS name, e."rawArtistName" AS artist, COUNT(*)::int AS plays,
             COUNT(DISTINCT EXTRACT(MONTH FROM (e."playedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}))::int AS months,
             MAX(a."coverUrl") AS "coverUrl"
      FROM "ListeningEvent" e LEFT JOIN "Album" a ON a.id = e."albumId"
      WHERE e."userId" = ${userId} AND e."playedAt" >= ${start} AND e."playedAt" < ${until} AND e."rawAlbumName" IS NOT NULL
      GROUP BY 1, 2 ORDER BY 3 DESC, 1 ASC LIMIT 1`,
    // a fita do ano: o disco que mais tocou em cada mês, com a capa quando o disco tem
    prisma.$queryRaw<Array<{ month: number; name: string; artist: string; plays: number; coverUrl: string | null }>>`
      SELECT DISTINCT ON (month) month, name, artist, plays, "coverUrl" FROM (
        SELECT EXTRACT(MONTH FROM (e."playedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::int AS month,
               e."rawAlbumName" AS name, e."rawArtistName" AS artist, COUNT(*)::int AS plays, MAX(a."coverUrl") AS "coverUrl"
        FROM "ListeningEvent" e LEFT JOIN "Album" a ON a.id = e."albumId"
        WHERE e."userId" = ${userId} AND e."playedAt" >= ${start} AND e."playedAt" < ${until} AND e."rawAlbumName" IS NOT NULL
        GROUP BY 1, 2, 3
      ) per_month ORDER BY month, plays DESC, name ASC`,
  ], { isolationLevel: "RepeatableRead" });

  // a corrida do ano: de janeiro até o mês corrente; se falhar, o capítulo só não aparece
  const throughMonth = now < end ? Number(localDay(now, timezone).slice(5, 7)) : 12;
  const race = await loadGenreRace(userId, until, [], throughMonth).catch(() => null);
  const n = (value: unknown) => Number(value ?? 0);
  // o nome do ano já tem o capítulo dele: "quem chegou" é o novato seguinte, se o do ano também for novo
  const arrived = newcomers.find((row) => row.name !== artists[0]?.name && n(row.plays) > 0);
  const facts: YearFacts = {
    year, ongoing: now < end, throughMonth: now < end ? Number(localDay(now, timezone).slice(5, 7)) : 12,
    plays: n(totals[0]?.plays), artists: n(totals[0]?.artists),
    topArtist: artists[0] ? { name: artists[0].name, plays: n(artists[0].plays) } : null,
    newcomer: arrived ? { name: arrived.name, plays: n(arrived.plays), firstMonth: n(arrived.month) } : null,
    peakHour: hours[0] ? { hour: n(hours[0].hour), plays: n(hours[0].plays) } : null,
    fullestMonth: months[0] ? { month: n(months[0].month), plays: n(months[0].plays) } : null,
    topAlbum: albums[0] ? { name: albums[0].name, artist: albums[0].artist, plays: n(albums[0].plays), months: n(albums[0].months), coverUrl: albums[0].coverUrl } : null,
    hours: Array.from({ length: 24 }, (_, hour) => n(hours.find((row) => n(row.hour) === hour)?.plays)),
    monthPlays: Array.from({ length: 12 }, (_, index) => n(months.find((row) => n(row.month) === index + 1)?.plays)),
    race: race && race.lanes.length >= 3 ? { months: race.months, lanes: race.lanes } : null,
  };
  const yearMonths: YearMonth[] = Array.from({ length: facts.throughMonth }, (_, index) => {
    const month = index + 1;
    const album = monthAlbums.find((row) => n(row.month) === month);
    return { month, plays: facts.monthPlays![index], album: album ? { name: album.name, artist: album.artist, coverUrl: album.coverUrl } : null };
  });
  return { year, ongoing: facts.ongoing, chapters: yearChapters(facts), months: yearMonths };
}
