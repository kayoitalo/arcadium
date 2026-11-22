import { prisma } from "@/lib/db/prisma";

/** A trilha de um nome: as audições dele mês a mês, desde a primeira, e as três faixas que mais tocaram. */
export interface ArtistTrail {
  months: Array<{ month: string; plays: number }>;
  tracks: Array<{ track: string; album: string | null; coverUrl: string | null; plays: number }>;
}

/** Os meses entre o primeiro e o último, inclusive os vazios: a curva não pode pular o tempo em que ele sumiu. */
export function fillMonths(rows: Array<{ month: string; plays: number }>): Array<{ month: string; plays: number }> {
  if (rows.length === 0) return [];
  const sorted = [...rows].sort((a, b) => a.month.localeCompare(b.month));
  const byMonth = new Map(sorted.map((row) => [row.month, Number(row.plays)]));
  const [fy, fm] = sorted[0].month.split("-").map(Number);
  const [ly, lm] = sorted[sorted.length - 1].month.split("-").map(Number);
  const out: Array<{ month: string; plays: number }> = [];
  for (let y = fy, m = fm; y < ly || (y === ly && m <= lm); m === 12 ? (y += 1, m = 1) : (m += 1)) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push({ month: key, plays: byMonth.get(key) ?? 0 });
  }
  return out;
}

export async function loadArtistTrail(userId: string, artist: string): Promise<ArtistTrail> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  let timezone = user?.timezone ?? "America/Sao_Paulo";
  try { new Intl.DateTimeFormat("pt-BR", { timeZone: timezone }); } catch { timezone = "America/Sao_Paulo"; }
  const [months, tracks] = await prisma.$transaction([
    prisma.$queryRaw<Array<{ month: string; plays: number }>>`
      SELECT to_char(("playedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}, 'YYYY-MM') AS month, COUNT(*)::int AS plays
      FROM "ListeningEvent" WHERE "userId" = ${userId} AND "rawArtistName" = ${artist}
      GROUP BY 1`,
    prisma.$queryRaw<Array<{ track: string; album: string | null; coverUrl: string | null; plays: number }>>`
      SELECT e."rawTrackName" AS track, MAX(e."rawAlbumName") AS album, MAX(a."coverUrl") AS "coverUrl", COUNT(*)::int AS plays
      FROM "ListeningEvent" e LEFT JOIN "Album" a ON a.id = e."albumId"
      WHERE e."userId" = ${userId} AND e."rawArtistName" = ${artist}
      GROUP BY 1 ORDER BY 4 DESC, 1 ASC LIMIT 3`,
  ]);
  return { months: fillMonths(months), tracks: tracks.map((row) => ({ ...row, plays: Number(row.plays) })) };
}
