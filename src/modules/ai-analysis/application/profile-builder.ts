

import { prisma } from "@/lib/db/prisma";
import { loadArtistGenres } from "@/modules/statistics/application/artist-genres";
import { decadeDistribution } from "@/modules/statistics/application/decades";
import { getPeriodRanges, type PeriodKey } from "@/modules/statistics/application/overview-service";

/** Abaixo disso o retrato das décadas é parcial demais para virar piada. */
const MIN_ERA_COVERAGE = 20;
import type { MusicProfileInput } from "../domain/ai-analysis.types";

export class ProfileBuilder {

  async buildProfile(userId: string, period: PeriodKey = "30d"): Promise<MusicProfileInput> {
    const { current, previous } = getPeriodRanges(period);

    const currentWhere =
      period === "all"
        ? { userId }
        : { userId, playedAt: { gte: current.start, lte: current.end } };

    const totalPlays = await prisma.listeningEvent.count({ where: currentWhere });

    const uniqueArtistsResult = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName"],
      where: currentWhere,
    });
    const uniqueArtists = uniqueArtistsResult.length;

    const uniqueTracksResult = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName", "rawTrackName"],
      where: currentWhere,
    });
    const uniqueTracks = uniqueTracksResult.length;

    const topArtistsGrouped = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName"],
      where: currentWhere,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    let previousArtistPlays = new Map<string, number>();
    let previousTotal = 0;
    if (previous && period !== "all") {
      const prevGrouped = await prisma.listeningEvent.groupBy({
        by: ["rawArtistName"],
        where: { userId, playedAt: { gte: previous.start, lt: previous.end } },
        _count: { id: true },
      });
      for (const item of prevGrouped) {
        previousArtistPlays.set((item as any).rawArtistName, (item as any)._count.id);
      }
      previousTotal = await prisma.listeningEvent.count({
        where: { userId, playedAt: { gte: previous.start, lt: previous.end } },
      });
    }

    const topArtists = topArtistsGrouped.map((item: any) => {
      const currentShare = totalPlays > 0 ? item._count.id / totalPlays : 0;
      const prevPlays = previousArtistPlays.get(item.rawArtistName) || 0;
      const prevShare = previousTotal > 0 ? prevPlays / previousTotal : 0;

      return {
        name: item.rawArtistName,
        plays: item._count.id,
        share: Number(currentShare.toFixed(3)),
        shareChange: previous ? Number((currentShare - prevShare).toFixed(3)) : null,
      };
    });

    const risingArtists = topArtists
      .filter((a) => a.shareChange !== null && a.shareChange > 0 && a.plays >= 3)
      .sort((a, b) => (b.shareChange || 0) - (a.shareChange || 0))
      .slice(0, 5)
      .map((a) => ({
        name: a.name,
        plays: a.plays,
        shareChange: a.shareChange || 0,
      }));

    const artistNames = topArtistsGrouped.map((a: any) => a.rawArtistName);
    // tags do MusicBrainz, com o gênero do catálogo da Apple de reserva
    const genresByArtist = await loadArtistGenres(artistNames);

    const genrePlays = new Map<string, number>();
    for (const item of topArtistsGrouped as any[]) {
      const tags = genresByArtist.get(item.rawArtistName) ?? [];
      const weight = tags.length ? item._count.id / tags.length : 0;
      for (const tag of tags) {
        genrePlays.set(tag, (genrePlays.get(tag) || 0) + weight);
      }
    }
    const totalGenreWeight = [...genrePlays.values()].reduce((a, b) => a + b, 0) || 1;
    const topGenres = [...genrePlays.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({
        name,
        share: Number((count / totalGenreWeight).toFixed(3)),
      }));

    let newArtists = 0;
    let newArtistPlays = 0;
    if (period !== "all") {
      const firstListens = await prisma.listeningEvent.groupBy({
        by: ["rawArtistName"], where: { userId }, _min: { playedAt: true }, _count: { id: true },
      });
      for (const firstListen of firstListens) {
        if (firstListen._min.playedAt && firstListen._min.playedAt >= current.start && firstListen._min.playedAt <= current.end) {
          newArtists++;
          const currentArtist = topArtistsGrouped.find((item: any) => item.rawArtistName === firstListen.rawArtistName);
          newArtistPlays += currentArtist?._count.id ?? 0;
        }
      }
    }

    const top5Plays = topArtists.slice(0, 5).reduce((acc, a) => acc + a.plays, 0);
    const topTracksGrouped = await prisma.listeningEvent.groupBy({
      by: ["rawTrackName"],
      where: currentWhere,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });
    const top10TrackPlays = topTracksGrouped.reduce((acc, t: any) => acc + t._count.id, 0);

    return {
      period,
      topArtists,
      topGenres,
      risingArtists,
      discovery: {
        newArtists,
        newArtistPlayShare: totalPlays > 0 ? Number((newArtistPlays / totalPlays).toFixed(3)) : 0,
      },
      concentration: {
        top5ArtistShare: totalPlays > 0 ? Number((top5Plays / totalPlays).toFixed(2)) : 0,
        top10TrackShare: totalPlays > 0 ? Number((top10TrackPlays / totalPlays).toFixed(2)) : 0,
      },
      totalPlays,
      uniqueArtists,
      uniqueTracks,
    };
  }
}
