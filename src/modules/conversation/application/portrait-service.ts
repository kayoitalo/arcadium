import { prisma } from "@/lib/db/prisma";
export interface PortraitArtist { name: string; plays: number; days: number; firstAt: Date; lastAt: Date }
export class PortraitService {
  async load(userId: string, now = new Date()) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    let timezone = user?.timezone ?? "America/Sao_Paulo";
    try { new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }); } catch { timezone = "America/Sao_Paulo"; }
    const recent = new Date(now.getTime() - 30 * 86400000); const before = new Date(now.getTime() - 60 * 86400000);
    const [summary, artists, changes] = await prisma.$transaction([
      prisma.listeningEvent.aggregate({ where: { userId, playedAt: { lte: now } }, _count: { id: true }, _min: { playedAt: true }, _max: { playedAt: true } }),
      prisma.$queryRaw<PortraitArtist[]>`SELECT "rawArtistName" AS "name", COUNT(*)::int AS "plays",
        COUNT(DISTINCT DATE(("playedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}))::int AS "days", MIN("playedAt") AS "firstAt", MAX("playedAt") AS "lastAt"
        FROM "ListeningEvent" WHERE "userId" = ${userId} AND "playedAt" <= ${now}
        GROUP BY "rawArtistName" ORDER BY COUNT(*) DESC, "rawArtistName" ASC LIMIT 20`,
      prisma.$queryRaw<Array<{ name: string; current: number; previous: number }>>`SELECT "rawArtistName" AS "name",
        COUNT(*) FILTER (WHERE "playedAt" >= ${recent})::int AS "current",
        COUNT(*) FILTER (WHERE "playedAt" < ${recent})::int AS "previous"
        FROM "ListeningEvent" WHERE "userId" = ${userId} AND "playedAt" >= ${before} AND "playedAt" <= ${now}
        GROUP BY "rawArtistName" ORDER BY COUNT(*) FILTER (WHERE "playedAt" >= ${recent}) DESC, "rawArtistName" ASC LIMIT 12`,
    ], { isolationLevel: "RepeatableRead" });
    return { asOf: now.toISOString(), timezone, total: summary._count.id, firstAt: summary._min.playedAt, lastAt: summary._max.playedAt,
      artists, changes, windows: { currentFrom: recent.toISOString(), previousFrom: before.toISOString() } };
  }
}
