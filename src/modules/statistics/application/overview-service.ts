import { prisma } from "@/lib/db/prisma";

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

export interface MetricSummary { totalPlays: number; uniqueArtists: number; uniqueTracks: number; estimatedMinutes: number; playsChangePercent: number | null }
export interface ConcentrationMetrics { top5ArtistShare: number; top10TrackShare: number; artistDiversityRatio: number }
export interface TopArtistItem { id: string | null; name: string; plays: number; share: number; country?: string | null; tags?: string[] }
export interface TopTrackItem { id: string | null; name: string; artistName: string; plays: number }
export interface AlbumItem { id: string | null; title: string; artistName: string; plays: number; coverUrl?: string }
export interface ActivityPoint { label: string; hours: number; plays: number }
export interface TasteShiftItem { genre: string; changePercent: number }
export interface DiscoveryItem { id: string; artistName: string; albumName: string; discoveredAt: string; plays: number; coverUrl?: string }
export interface RecommendationItem { id: string; title: string; artistName: string; coverUrl?: string; reason: string }
export interface AiStorySummary { headline: string; narrative: string; insight: string }
export interface OverviewData {
  period: PeriodKey; summary: MetricSummary; concentration: ConcentrationMetrics;
  topArtists: TopArtistItem[]; topTracks: TopTrackItem[]; topAlbums: AlbumItem[];
  listeningActivity: ActivityPoint[]; tasteShift: { rising: TasteShiftItem[]; declining: TasteShiftItem[] };
  discoveries: DiscoveryItem[]; recommended: RecommendationItem | null; aiStory: AiStorySummary;
  syncStatus: { lastSyncedAt: Date | null; totalStoredEvents: number };
}

export function createEmptyOverview(period: PeriodKey, lastSyncedAt: Date | null = null, totalStoredEvents = 0): OverviewData {
  return {
    period,
    summary: { totalPlays: 0, uniqueArtists: 0, uniqueTracks: 0, estimatedMinutes: 0, playsChangePercent: null },
    concentration: { top5ArtistShare: 0, top10TrackShare: 0, artistDiversityRatio: 0 },
    topArtists: [], topTracks: [], topAlbums: [], listeningActivity: [],
    tasteShift: { rising: [], declining: [] }, discoveries: [], recommended: null,
    aiStory: {
      headline: "Seu histórico musical começa aqui.",
      narrative: "Sincronize suas audições do Last.fm para gerar estatísticas verificáveis.",
      insight: "Nenhuma conclusão foi gerada sem dados suficientes.",
    },
    syncStatus: { lastSyncedAt, totalStoredEvents },
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
    const [connection, totalStoredEvents] = await Promise.all([
      prisma.providerConnection.findFirst({ where: { userId, provider: "lastfm" } }),
      prisma.listeningEvent.count({ where: { userId } }),
    ]);
    const empty = createEmptyOverview(period, connection?.lastSyncedAt ?? null, totalStoredEvents);
    if (totalStoredEvents === 0) return empty;

    const currentWhere = period === "all" ? { userId } : { userId, playedAt: { gte: current.start, lte: current.end } };
    const currentPlays = await prisma.listeningEvent.count({ where: currentWhere });
    if (currentPlays === 0) return empty;

    const [artistGroups, trackGroups, albumGroups, periodEvents] = await Promise.all([
      prisma.listeningEvent.groupBy({ by: ["rawArtistName"], where: currentWhere, _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
      prisma.listeningEvent.groupBy({ by: ["rawArtistName", "rawTrackName"], where: currentWhere, _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
      prisma.listeningEvent.groupBy({ by: ["rawArtistName", "rawAlbumName"], where: { ...currentWhere, NOT: { rawAlbumName: null } }, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: 6 }),
      prisma.listeningEvent.findMany({ where: currentWhere, select: { playedAt: true }, orderBy: { playedAt: "asc" } }),
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
        tags: metadata?.tags?.split(",").map((tag) => tag.trim()).filter(Boolean) ?? [],
      };
    });
    const topTracks: TopTrackItem[] = trackGroups.slice(0, 10).map((item) => ({
      id: null, name: item.rawTrackName, artistName: item.rawArtistName, plays: item._count.id,
    }));
    const topAlbums: AlbumItem[] = albumGroups.filter((item) => item.rawAlbumName).map((item) => ({
      id: null, title: item.rawAlbumName!, artistName: item.rawArtistName, plays: item._count.id,
    }));

    const previousPlays = previous
      ? await prisma.listeningEvent.count({ where: { userId, playedAt: { gte: previous.start, lt: previous.end } } })
      : 0;
    const firstListens = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName"], where: { userId }, _min: { playedAt: true }, _count: { id: true },
      orderBy: { _min: { playedAt: "desc" } }, take: 100,
    });
    const discoveries: DiscoveryItem[] = firstListens
      .filter((item) => item._min.playedAt && item._min.playedAt >= current.start && item._min.playedAt <= current.end)
      .slice(0, 6)
      .map((item, index) => ({ id: `discovery-${index}`, artistName: item.rawArtistName, albumName: "", discoveredAt: item._min.playedAt!.toISOString(), plays: item._count.id }));
    const latestRecommendation = await prisma.recommendationItem.findFirst({
      where: { session: { userId } }, orderBy: { createdAt: "desc" },
      select: { id: true, trackName: true, artistName: true, reason: true },
    });
    const mainArtist = topArtists[0];

    return {
      period,
      summary: {
        totalPlays: currentPlays, uniqueArtists: artistGroups.length, uniqueTracks: trackGroups.length,
        estimatedMinutes: Math.round(currentPlays * 3.5), playsChangePercent: previous ? percentChange(currentPlays, previousPlays) : null,
      },
      concentration: {
        top5ArtistShare: Math.round((topArtists.slice(0, 5).reduce((sum, item) => sum + item.plays, 0) / currentPlays) * 100),
        top10TrackShare: Math.round((topTracks.reduce((sum, item) => sum + item.plays, 0) / currentPlays) * 100),
        artistDiversityRatio: Math.min(100, Math.round((artistGroups.length / currentPlays) * 100)),
      },
      topArtists, topTracks, topAlbums, listeningActivity: activityByUtcDay(periodEvents),
      tasteShift: { rising: [], declining: [] }, discoveries,
      recommended: latestRecommendation ? {
        id: latestRecommendation.id, title: latestRecommendation.trackName, artistName: latestRecommendation.artistName,
        reason: latestRecommendation.reason ?? "Recomendação baseada no seu perfil musical.",
      } : null,
      aiStory: {
        headline: `${mainArtist.name} liderou este período.`,
        narrative: `Foram ${currentPlays} audições entre ${artistGroups.length} artistas e ${trackGroups.length} faixas distintas.`,
        insight: `${mainArtist.name} representou ${(mainArtist.share * 100).toFixed(1)}% das audições do período.`,
      },
      syncStatus: { lastSyncedAt: connection?.lastSyncedAt ?? null, totalStoredEvents },
    };
  }
}
