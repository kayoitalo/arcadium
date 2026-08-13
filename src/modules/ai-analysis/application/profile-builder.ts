/**
 * Profile Builder
 *
 * Blueprint §11.1: Build a compact MusicProfileInput from stored statistics.
 * Include ranked signals and representative evidence, not thousands of scrobbles.
 *
 * Blueprint Decision 11: AI data minimization by construction.
 * Excludes identity, credentials, and exact raw timelines.
 */

import { prisma } from "@/lib/db/prisma";
import { getPeriodRanges, type PeriodKey } from "@/modules/statistics/application/overview-service";
import type { MusicProfileInput } from "../domain/ai-analysis.types";

export class ProfileBuilder {
  /**
   * Build a pseudonymized, aggregated profile input for AI analysis.
   * No user ID, email, or raw timestamps are included.
   */
  async buildProfile(userId: string, period: PeriodKey = "30d"): Promise<MusicProfileInput> {
    const { current, previous } = getPeriodRanges(period);

    const currentWhere =
      period === "all"
        ? { userId }
        : { userId, playedAt: { gte: current.start, lte: current.end } };

    // Total plays
    const totalPlays = await prisma.listeningEvent.count({ where: currentWhere });

    // Unique artists & tracks
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

    // Top artists with share
    const topArtistsGrouped = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName"],
      where: currentWhere,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    // Previous period for share change calculation
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

    // Rising artists: positive share change with minimum-play threshold
    const risingArtists = topArtists
      .filter((a) => a.shareChange !== null && a.shareChange > 0 && a.plays >= 3)
      .sort((a, b) => (b.shareChange || 0) - (a.shareChange || 0))
      .slice(0, 5)
      .map((a) => ({
        name: a.name,
        plays: a.plays,
        shareChange: a.shareChange || 0,
      }));

    // Top genres from enriched artists
    const artistNames = topArtistsGrouped.map((a: any) => a.rawArtistName);
    const enrichedArtists = await prisma.artist.findMany({
      where: { name: { in: artistNames }, tags: { not: null } },
      select: { tags: true },
    });

    const genrePlays = new Map<string, number>();
    for (const artist of enrichedArtists) {
      if (artist.tags) {
        for (const tag of artist.tags.split(",").map((t: string) => t.trim()).filter(Boolean)) {
          genrePlays.set(tag, (genrePlays.get(tag) || 0) + 1);
        }
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

    // New artists in period (first listen in current period)
    let newArtists = 0;
    let newArtistPlays = 0;
    if (period !== "all") {
      for (const artistGroup of uniqueArtistsResult) {
        const artistName = (artistGroup as any).rawArtistName;
        const firstListen = await prisma.listeningEvent.findFirst({
          where: { userId, rawArtistName: artistName },
          orderBy: { playedAt: "asc" },
          select: { playedAt: true },
        });
        if (firstListen && firstListen.playedAt >= current.start) {
          newArtists++;
          const artistPlays = topArtistsGrouped.find((a: any) => a.rawArtistName === artistName);
          newArtistPlays += (artistPlays as any)?._count?.id || 1;
        }
      }
    }

    // Concentration metrics
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
