import { prisma } from "@/lib/db/prisma";
import { loadArtistGenres } from "@/modules/statistics/application/artist-genres";
import { decadeDistribution } from "@/modules/statistics/application/decades";
import { getPeriodRanges, type PeriodKey } from "@/modules/statistics/application/overview-service";
import type { MusicProfileInput } from "../domain/ai-analysis.types";
import { findComebacks, findOutliers, findUnlikelyTransition, longestLoop, topTrackByArtist } from "./listening-signals";

/** Abaixo disso o retrato das décadas é parcial demais para virar piada. */
const MIN_ERA_COVERAGE = 20;

/** Os gêneros que definem o "padrão" do período — a surpresa se mede contra eles. */
const DOMINANT_GENRES = 5;

/** Sumido há pelo menos isso, e com a pessoa ouvindo música nesse intervalo. */
const COMEBACK_GAP_DAYS = 90;
const MIN_PLAYS_BEFORE_COMEBACK = 30;

export class ProfileBuilder {

  async buildProfile(userId: string, period: PeriodKey = "30d"): Promise<MusicProfileInput> {
    const { current, previous } = getPeriodRanges(period);

    const currentWhere =
      period === "all"
        ? { userId }
        : { userId, playedAt: { gte: current.start, lte: current.end } };

    const totalPlays = await prisma.listeningEvent.count({ where: currentWhere });

    // todos os artistas do período com contagem: base do ranking, da surpresa e das voltas
    const artistPlays = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName"],
      where: currentWhere,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });
    const uniqueArtists = artistPlays.length;

    // com contagem: além de medir as faixas únicas, diz qual música de cada artista mais tocou
    const trackPlays = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName", "rawTrackName"],
      where: currentWhere,
      _count: { id: true },
    });
    const uniqueTracks = trackPlays.length;
    const topTrackOf = topTrackByArtist(
      (trackPlays as any[])
        .filter((row) => row.rawTrackName)
        .map((row) => ({ artist: row.rawArtistName, track: row.rawTrackName, plays: row._count?.id ?? 0 })),
    );

    const topArtistsGrouped = artistPlays.slice(0, 10);

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

    // tags do MusicBrainz, com o gênero do catálogo da Apple de reserva — de
    // todos os artistas do período, porque a surpresa mora fora do topo
    const genresByArtist = await loadArtistGenres(artistPlays.map((item: any) => item.rawArtistName));

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

    // o que mais tocou: base para as curiosidades sobre "o mais escutado"
    const [topTrack] = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName", "rawTrackName"],
      where: currentWhere,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 1,
    });
    // os 6 discos mais ouvidos: o primeiro é "o mais ouvido", todos são o rack da Visão geral
    const albumRows = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName", "rawAlbumName"],
      where: { ...currentWhere, NOT: { rawAlbumName: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 6,
    });
    const [topAlbum] = albumRows;
    const rackAlbums = (albumRows as any[])
      .filter((row) => row.rawAlbumName)
      .map((row) => ({ album: row.rawAlbumName as string, artist: row.rawArtistName as string, plays: row._count.id as number }));

    // em ordem cronológica: serve às décadas e à faixa que tocou em sequência
    const periodEvents = await prisma.listeningEvent.findMany({
      where: currentWhere,
      select: { rawArtistName: true, rawTrackName: true, album: { select: { releaseYear: true } } },
      orderBy: { playedAt: "asc" },
    });

    const decades = decadeDistribution(periodEvents.map((event) => event.album?.releaseYear));
    const eras = decades.coverage >= MIN_ERA_COVERAGE
      ? [...decades.items]
          .sort((a, b) => b.share - a.share)
          .slice(0, 5)
          .map((item) => ({ decade: `${item.decade}s`, share: Number((item.share / 100).toFixed(3)) }))
      : [];

    const orderedPlays = periodEvents.map((event) => ({ artist: event.rawArtistName, track: event.rawTrackName }));
    const loop = longestLoop(orderedPlays);
    const transition = findUnlikelyTransition(
      orderedPlays,
      genresByArtist,
      new Map((artistPlays as any[]).map((item) => [item.rawArtistName, item._count.id])),
    );

    // o "padrão" do período vem de todos os artistas, pesados pelas audições —
    // medido só pelo topo, o gênero principal de quem ouve muitos artistas
    // pequenos (hip hop, por exemplo) viraria surpresa por engano
    const periodGenreWeight = new Map<string, number>();
    for (const item of artistPlays as any[]) {
      const genres = genresByArtist.get(item.rawArtistName) ?? [];
      for (const genre of genres) {
        periodGenreWeight.set(genre, (periodGenreWeight.get(genre) ?? 0) + item._count.id / genres.length);
      }
    }
    const dominantGenres = [...periodGenreWeight.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, DOMINANT_GENRES)
      .map(([genre]) => genre);

    const outliers = findOutliers(
      artistPlays.map((item: any) => ({
        name: item.rawArtistName,
        plays: item._count.id,
        genres: genresByArtist.get(item.rawArtistName) ?? [],
      })),
      dominantGenres,
      { exclude: new Set(topArtists.map((artist) => artist.name)) },
    );

    // quem voltou só faz sentido com um "antes" — no período "tudo" não há.
    // E só se a pessoa estava ouvindo música antes do período: com um buraco
    // no histórico, todo artista pareceria ter voltado de anos sumido
    let comebacks: MusicProfileInput["comebacks"] = [];
    const activeBefore = period !== "all" && await prisma.listeningEvent.count({
      where: {
        userId,
        playedAt: { gte: new Date(current.start.getTime() - COMEBACK_GAP_DAYS * 86_400_000), lt: current.start },
      },
    }) >= MIN_PLAYS_BEFORE_COMEBACK;
    if (activeBefore && artistPlays.length > 0) {
      const lastBefore = await prisma.listeningEvent.groupBy({
        by: ["rawArtistName"],
        where: {
          userId,
          rawArtistName: { in: artistPlays.map((item: any) => item.rawArtistName) },
          playedAt: { lt: current.start },
        },
        _max: { playedAt: true },
      });
      const lastSeen = new Map<string, Date>();
      for (const row of lastBefore as any[]) {
        if (row._max?.playedAt) lastSeen.set(row.rawArtistName, new Date(row._max.playedAt));
      }
      comebacks = findComebacks(
        artistPlays.map((item: any) => ({ name: item.rawArtistName, plays: item._count.id })),
        lastSeen,
        current.start,
        { minGapDays: COMEBACK_GAP_DAYS },
      );
    }

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
      eras,
      mostPlayed: {
        track: topTrack?.rawTrackName
          ? { name: topTrack.rawTrackName, artist: topTrack.rawArtistName, plays: (topTrack as any)._count.id }
          : null,
        album: (topAlbum as any)?.rawAlbumName
          ? { name: (topAlbum as any).rawAlbumName, artist: topAlbum.rawArtistName, plays: (topAlbum as any)._count.id }
          : null,
      },
      outliers,
      comebacks,
      loop,
      transition,
      rackAlbums,
      // só dos artistas que aparecem acima: a referência parte do que tocou de fato
      topTracks: Object.fromEntries(
        [...new Set([
          ...topArtists.slice(0, 5).map((artist) => artist.name),
          ...risingArtists.map((artist) => artist.name),
          ...outliers.map((artist) => artist.name),
          ...(comebacks ?? []).map((artist) => artist.name),
        ])].flatMap((name) => (topTrackOf.has(name) ? [[name, topTrackOf.get(name)!]] : [])),
      ),
    };
  }
}
