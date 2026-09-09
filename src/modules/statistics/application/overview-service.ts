import { prisma } from "@/lib/db/prisma";
import { filterGenreTags } from "@/modules/enrichment/domain/genre-tags";

export type PeriodKey = "7d" | "30d" | "1y" | "all";
export interface PeriodRange { start: Date; end: Date }

export function getPeriodRanges(period: PeriodKey, referenceDate = new Date()): { current: PeriodRange; previous: PeriodRange | null } {
  const end = new Date(referenceDate);
  if (period === "all") return { current: { start: new Date(0), end }, previous: null };
  const days = period === "7d" ? 7 : period === "1y" ? 365 : 30;
  const start = new Date(end.getTime() - days * 86_400_000);
  return { current: { start, end }, previous: { start: new Date(start.getTime() - days * 86_400_000), end: start } };
}

export function percentChange(current: number, previous: number): number | null {
  return previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
}

export interface MetricSummary {
  totalPlays: number; uniqueArtists: number; uniqueTracks: number; listeningMinutes: number;
  durationSource: "TRACK_METADATA" | "ESTIMATE"; playsChangePercent: number | null;
  artistsChangePercent: number | null; tracksChangePercent: number | null;
}
export interface ConcentrationMetrics { top5ArtistShare: number; top10TrackShare: number; artistDiversityRatio: number }
export interface TopArtistItem { id: string | null; name: string; plays: number; share: number; country?: string | null; tags?: string[] }
export interface TopTrackItem { id: string | null; name: string; artistName: string; plays: number }
export interface AlbumItem { id: string | null; title: string; artistName: string; plays: number; coverUrl?: string }
export interface ActivityPoint { label: string; hours: number; plays: number }
export interface TasteShiftItem { genre: string; changePercent: number; currentShare: number; previousShare: number }
export interface DiscoveryItem { id: string; artistName: string; albumName: string; discoveredAt: string; plays: number; coverUrl?: string }
export interface RecommendationItem { id: string; title: string; artistName: string; coverUrl?: string; reason: string }
export interface AiStorySummary { headline: string; narrative: string; insight: string }
export interface DataQuality {
  linkedEvents: number; linkedEventsPercentage: number; enrichedArtists: number; totalArtists: number;
  artistMetadataPercentage: number; coveredAlbums: number; totalAlbums: number; albumCoverPercentage: number;
}

export function calculateTasteShift(
  currentArtists: Array<{ name: string; plays: number; tags: string[] }>,
  previousArtists: Array<{ name: string; plays: number; tags: string[] }>,
): { rising: TasteShiftItem[]; declining: TasteShiftItem[] } {
  const aggregate = (artists: typeof currentArtists) => {
    const totals = new Map<string, number>();
    for (const artist of artists) {
      if (!artist.tags.length) continue;
      const contribution = artist.plays / artist.tags.length;
      for (const rawTag of artist.tags) {
        const tag = rawTag.trim().toLowerCase();
        if (tag) totals.set(tag, (totals.get(tag) ?? 0) + contribution);
      }
    }
    return totals;
  };
  const current = aggregate(currentArtists);
  const previous = aggregate(previousArtists);
  const shifts: TasteShiftItem[] = [];
  for (const genre of new Set([...current.keys(), ...previous.keys()])) {
    const currentValue = current.get(genre) ?? 0;
    const previousValue = previous.get(genre) ?? 0;
    if (previousValue === 0 || currentValue === previousValue) continue;
    const currentTotal = [...current.values()].reduce((sum, value) => sum + value, 0) || 1;
    const previousTotal = [...previous.values()].reduce((sum, value) => sum + value, 0) || 1;
    shifts.push({
      genre,
      changePercent: Math.round(((currentValue - previousValue) / previousValue) * 100),
      currentShare: Number(((currentValue / currentTotal) * 100).toFixed(1)),
      previousShare: Number(((previousValue / previousTotal) * 100).toFixed(1)),
    });
  }
  return {
    rising: shifts.filter((item) => item.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, 5),
    declining: shifts.filter((item) => item.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 5),
  };
}
export interface OverviewData {
  period: PeriodKey; summary: MetricSummary; concentration: ConcentrationMetrics;
  topArtists: TopArtistItem[]; topTracks: TopTrackItem[]; topAlbums: AlbumItem[];
  listeningActivity: ActivityPoint[]; tasteShift: { rising: TasteShiftItem[]; declining: TasteShiftItem[] };
  discoveries: DiscoveryItem[]; recommended: RecommendationItem | null; aiStory: AiStorySummary;
  syncStatus: { lastSyncedAt: Date | null; totalStoredEvents: number };
  dataQuality: DataQuality;
}

export function createEmptyOverview(period: PeriodKey, lastSyncedAt: Date | null = null, totalStoredEvents = 0): OverviewData {
  return {
    period,
    summary: { totalPlays: 0, uniqueArtists: 0, uniqueTracks: 0, listeningMinutes: 0, durationSource: "ESTIMATE", playsChangePercent: null, artistsChangePercent: null, tracksChangePercent: null },
    concentration: { top5ArtistShare: 0, top10TrackShare: 0, artistDiversityRatio: 0 },
    topArtists: [], topTracks: [], topAlbums: [], listeningActivity: [],
    tasteShift: { rising: [], declining: [] }, discoveries: [], recommended: null,
    aiStory: {
      headline: "Seu histórico musical começa aqui.",
      narrative: "Sincronize suas audições do Last.fm para gerar estatísticas verificáveis.",
      insight: "Nenhuma conclusão foi gerada sem dados suficientes.",
    },
    syncStatus: { lastSyncedAt, totalStoredEvents },
    dataQuality: { linkedEvents: 0, linkedEventsPercentage: 0, enrichedArtists: 0, totalArtists: 0, artistMetadataPercentage: 0, coveredAlbums: 0, totalAlbums: 0, albumCoverPercentage: 0 },
  };
}

export function activityByUtcDay(events: { playedAt: Date }[]): ActivityPoint[] {
  const days = new Map<string, number>();
  for (const event of events) {
    const day = event.playedAt.toISOString().slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + 1);
  }
  return [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, plays]) => ({
    label, plays, hours: Number(((plays * 3.5) / 60).toFixed(1)),
  }));
}

export class OverviewService {
  async getOverviewData(userId: string, period: PeriodKey = "30d", referenceDate = new Date()): Promise<OverviewData> {
    const { current, previous } = getPeriodRanges(period, referenceDate);
    const [connection, totalStoredEvents, linkedEvents, totalArtists, enrichedArtists, totalAlbums, coveredAlbums] = await Promise.all([
      prisma.providerConnection.findFirst({ where: { userId, provider: "lastfm" } }),
      prisma.listeningEvent.count({ where: { userId } }),
      prisma.listeningEvent.count({ where: { userId, artistId: { not: null } } }),
      prisma.artist.count(),
      prisma.artist.count({ where: { metadataStatus: "RESOLVED" } }),
      prisma.album.count(),
      prisma.album.count({ where: { coverUrl: { not: null } } }),
    ]);
    const empty = createEmptyOverview(period, connection?.lastSyncedAt ?? null, totalStoredEvents);
    empty.dataQuality = {
      linkedEvents, linkedEventsPercentage: totalStoredEvents ? Math.round((linkedEvents / totalStoredEvents) * 100) : 0,
      enrichedArtists, totalArtists, artistMetadataPercentage: totalArtists ? Math.round((enrichedArtists / totalArtists) * 100) : 0,
      coveredAlbums, totalAlbums, albumCoverPercentage: totalAlbums ? Math.round((coveredAlbums / totalAlbums) * 100) : 0,
    };
    if (totalStoredEvents === 0) return empty;

    const currentWhere = period === "all" ? { userId } : { userId, playedAt: { gte: current.start, lte: current.end } };
    const currentPlays = await prisma.listeningEvent.count({ where: currentWhere });
    if (currentPlays === 0) return empty;

    const [artistGroups, trackGroups, albumGroups, periodEvents] = await Promise.all([
      prisma.listeningEvent.groupBy({ by: ["rawArtistName"], where: currentWhere, _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
      prisma.listeningEvent.groupBy({ by: ["rawArtistName", "rawTrackName"], where: currentWhere, _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
      prisma.listeningEvent.groupBy({ by: ["rawArtistName", "rawAlbumName"], where: { ...currentWhere, NOT: { rawAlbumName: null } }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 6 }),
      prisma.listeningEvent.findMany({ where: currentWhere, select: { playedAt: true, track: { select: { durationMs: true } } }, orderBy: { playedAt: "asc" } }),
    ]);

    const topArtistGroups = artistGroups.slice(0, 10);
    const artistMetadata = await prisma.artist.findMany({
      where: { name: { in: topArtistGroups.map((item) => item.rawArtistName) } },
      select: { id: true, name: true, country: true, tags: true },
    });
    const metadataByName = new Map(artistMetadata.map((artist) => [artist.name, artist]));
    const topArtists: TopArtistItem[] = topArtistGroups.map((item) => {
      const metadata = metadataByName.get(item.rawArtistName);
      return {
        id: metadata?.id ?? null, name: item.rawArtistName, plays: item._count.id,
        share: Number((item._count.id / currentPlays).toFixed(3)), country: metadata?.country ?? null,
        tags: filterGenreTags(metadata?.tags?.split(",") ?? []),
      };
    });
    const topTracks: TopTrackItem[] = trackGroups.slice(0, 10).map((item) => ({
      id: null, name: item.rawTrackName, artistName: item.rawArtistName, plays: item._count.id,
    }));
    const albumKeys = albumGroups.filter((item) => item.rawAlbumName);
    const canonicalAlbums = albumKeys.length ? await prisma.album.findMany({
      where: { OR: albumKeys.map((item) => ({ name: item.rawAlbumName!, artist: { name: item.rawArtistName } })) },
      select: { id: true, name: true, coverUrl: true, artist: { select: { name: true } } },
    }) : [];
    const canonicalByKey = new Map(canonicalAlbums.map((album) => [`${album.artist.name}\u0000${album.name}`, album]));
    const topAlbums: AlbumItem[] = albumKeys.map((item) => {
      const canonical = canonicalByKey.get(`${item.rawArtistName}\u0000${item.rawAlbumName}`);
      return {
        id: canonical?.id ?? null, title: item.rawAlbumName!, artistName: item.rawArtistName,
        plays: item._count.id, coverUrl: canonical?.coverUrl ?? undefined,
      };
    });

    const [previousPlays, previousArtistGroups, previousTrackGroups] = previous ? await Promise.all([
      prisma.listeningEvent.count({ where: { userId, playedAt: { gte: previous.start, lt: previous.end } } }),
      prisma.listeningEvent.groupBy({
        by: ["rawArtistName"], where: { userId, playedAt: { gte: previous.start, lt: previous.end } },
        _count: { id: true }, orderBy: { _count: { id: "desc" } },
      }),
      prisma.listeningEvent.groupBy({ by: ["rawArtistName", "rawTrackName"], where: { userId, playedAt: { gte: previous.start, lt: previous.end } } }),
    ]) : [0, [], []];
    const genreArtistNames = [...new Set([...artistGroups.map((item) => item.rawArtistName), ...previousArtistGroups.map((item) => item.rawArtistName)])];
    const genreMetadata = genreArtistNames.length ? await prisma.artist.findMany({
      where: { name: { in: genreArtistNames }, tags: { not: null } }, select: { name: true, tags: true },
    }) : [];
    const tagsByArtist = new Map(genreMetadata.map((artist) => [artist.name, filterGenreTags(artist.tags?.split(",") ?? [])]));
    const tasteShift = previous ? calculateTasteShift(
      artistGroups.map((item) => ({ name: item.rawArtistName, plays: item._count.id, tags: tagsByArtist.get(item.rawArtistName) ?? [] })),
      previousArtistGroups.map((item) => ({ name: item.rawArtistName, plays: item._count.id, tags: tagsByArtist.get(item.rawArtistName) ?? [] })),
    ) : { rising: [], declining: [] };
    const firstListens = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName"], where: { userId }, _min: { playedAt: true }, _count: { id: true },
      orderBy: { _min: { playedAt: "desc" } }, take: 100,
    });
    const discoverySeeds = firstListens
      .filter((item) => item._min.playedAt && item._min.playedAt >= current.start && item._min.playedAt <= current.end)
      .slice(0, 6);
    const discoveryEvents = await Promise.all(discoverySeeds.map((item) => prisma.listeningEvent.findFirst({
      where: { userId, rawArtistName: item.rawArtistName }, orderBy: { playedAt: "asc" },
      select: { id: true, rawAlbumName: true, album: { select: { coverUrl: true } } },
    })));
    const discoveries: DiscoveryItem[] = discoverySeeds.map((item, index) => ({
      id: discoveryEvents[index]?.id ?? `discovery-${index}`, artistName: item.rawArtistName,
      albumName: discoveryEvents[index]?.rawAlbumName ?? "", discoveredAt: item._min.playedAt!.toISOString(),
      plays: item._count.id, coverUrl: discoveryEvents[index]?.album?.coverUrl ?? undefined,
    }));
    const latestRecommendation = await prisma.recommendationItem.findFirst({
      where: { session: { userId } }, orderBy: { createdAt: "desc" },
      select: { id: true, trackName: true, artistName: true, albumName: true, reason: true },
    });
    const recommendationAlbum = latestRecommendation?.albumName ? await prisma.album.findFirst({
      where: { name: latestRecommendation.albumName, artist: { name: latestRecommendation.artistName } },
      select: { coverUrl: true },
    }) : null;
    const mainArtist = topArtists[0];
    const knownDurationMs = periodEvents.reduce((sum, event) => sum + (event.track?.durationMs ?? 0), 0);
    const knownDurationEvents = periodEvents.filter((event) => event.track?.durationMs).length;
    const listeningMinutes = Math.round((knownDurationMs + (currentPlays - knownDurationEvents) * 210_000) / 60_000);

    return {
      period,
      summary: {
        totalPlays: currentPlays, uniqueArtists: artistGroups.length, uniqueTracks: trackGroups.length,
        listeningMinutes, durationSource: knownDurationEvents === currentPlays ? "TRACK_METADATA" : "ESTIMATE",
        playsChangePercent: previous ? percentChange(currentPlays, previousPlays) : null,
        artistsChangePercent: previous ? percentChange(artistGroups.length, previousArtistGroups.length) : null,
        tracksChangePercent: previous ? percentChange(trackGroups.length, previousTrackGroups.length) : null,
      },
      concentration: {
        top5ArtistShare: Math.round((topArtists.slice(0, 5).reduce((sum, item) => sum + item.plays, 0) / currentPlays) * 100),
        top10TrackShare: Math.round((topTracks.reduce((sum, item) => sum + item.plays, 0) / currentPlays) * 100),
        artistDiversityRatio: Math.min(100, Math.round((artistGroups.length / currentPlays) * 100)),
      },
      topArtists, topTracks, topAlbums, listeningActivity: activityByUtcDay(periodEvents),
      tasteShift, discoveries,
      recommended: latestRecommendation ? {
        id: latestRecommendation.id, title: latestRecommendation.trackName, artistName: latestRecommendation.artistName,
        reason: latestRecommendation.reason ?? "Motivo não registrado para este item.", coverUrl: recommendationAlbum?.coverUrl ?? undefined,
      } : null,
      aiStory: {
        headline: `${mainArtist.name} liderou este período.`,
        narrative: `Foram ${currentPlays} audições entre ${artistGroups.length} artistas e ${trackGroups.length} faixas distintas.`,
        insight: `${mainArtist.name} representou ${(mainArtist.share * 100).toFixed(1)}% das audições do período.`,
      },
      syncStatus: { lastSyncedAt: connection?.lastSyncedAt ?? null, totalStoredEvents },
      dataQuality: empty.dataQuality,
    };
  }
}
