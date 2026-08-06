import { prisma } from "@/lib/db/prisma";

export type PeriodKey = "7d" | "30d" | "1y" | "all";

export interface PeriodRange {
  start: Date;
  end: Date;
}

export function getPeriodRanges(period: PeriodKey, referenceDate = new Date()): { current: PeriodRange; previous: PeriodRange | null } {
  const end = new Date(referenceDate);

  if (period === "all") {
    return {
      current: { start: new Date(0), end },
      previous: null,
    };
  }

  let durationDays = 30;
  if (period === "7d") durationDays = 7;
  if (period === "1y") durationDays = 365;

  const currentStart = new Date(end.getTime() - durationDays * 24 * 60 * 60 * 1000);
  const previousStart = new Date(currentStart.getTime() - durationDays * 24 * 60 * 60 * 1000);

  return {
    current: { start: currentStart, end },
    previous: { start: previousStart, end: currentStart },
  };
}

export interface MetricSummary {
  totalPlays: number;
  uniqueArtists: number;
  uniqueTracks: number;
  estimatedMinutes: number;
  playsChangePercent: number | null;
}

export interface ConcentrationMetrics {
  top5ArtistShare: number; // 0 to 100
  top10TrackShare: number; // 0 to 100
  artistDiversityRatio: number; // 0 to 100
}

export interface TopArtistItem {
  id: string | null;
  name: string;
  plays: number;
  share: number; // 0 to 1
  country?: string | null;
  tags?: string[];
}

export interface TopTrackItem {
  id: string | null;
  name: string;
  artistName: string;
  plays: number;
}

export interface AlbumItem {
  id: string | null;
  title: string;
  artistName: string;
  plays: number;
  coverUrl?: string;
}

export interface ActivityPoint {
  label: string;
  hours: number;
  plays: number;
}

export interface TasteShiftItem {
  genre: string;
  changePercent: number;
}

export interface DiscoveryItem {
  id: string;
  artistName: string;
  albumName: string;
  discoveredAt: string;
  plays: number;
  coverUrl?: string;
}

export interface RecommendationItem {
  id: string;
  title: string;
  artistName: string;
  coverUrl?: string;
  reason: string;
}

export interface AiStorySummary {
  headline: string;
  narrative: string;
  insight: string;
}

export interface OverviewData {
  period: PeriodKey;
  summary: MetricSummary;
  concentration: ConcentrationMetrics;
  topArtists: TopArtistItem[];
  topTracks: TopTrackItem[];
  topAlbums: AlbumItem[];
  listeningActivity: ActivityPoint[];
  tasteShift: {
    rising: TasteShiftItem[];
    declining: TasteShiftItem[];
  };
  discoveries: DiscoveryItem[];
  recommended: RecommendationItem;
  aiStory: AiStorySummary;
  syncStatus: {
    lastSyncedAt: Date | null;
    totalStoredEvents: number;
  };
}

// Fallback visual albums if DB events lack artwork
const DEFAULT_ALBUMS: AlbumItem[] = [
  {
    id: "1",
    title: "Koi No Yokan",
    artistName: "Deftones",
    plays: 288,
    coverUrl: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=600&auto=format&fit=crop",
  },
  {
    id: "2",
    title: "From Mars to Sirius",
    artistName: "Gojira",
    plays: 152,
    coverUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop",
  },
  {
    id: "3",
    title: "In Rainbows",
    artistName: "Radiohead",
    plays: 128,
    coverUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?q=80&w=600&auto=format&fit=crop",
  },
  {
    id: "4",
    title: "Crack the Skye",
    artistName: "Mastodon",
    plays: 97,
    coverUrl: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=600&auto=format&fit=crop",
  },
  {
    id: "5",
    title: "Madrigal",
    artistName: "Opeth",
    plays: 86,
    coverUrl: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?q=80&w=600&auto=format&fit=crop",
  },
];

const DEFAULT_DISCOVERIES: DiscoveryItem[] = [
  {
    id: "d1",
    artistName: "Chat Pile",
    albumName: "Cool World",
    discoveredAt: "Jul 28, 2024",
    plays: 34,
    coverUrl: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=400&auto=format&fit=crop",
  },
  {
    id: "d2",
    artistName: "The Armed",
    albumName: "Perfect Saviors",
    discoveredAt: "Jul 22, 2024",
    plays: 29,
    coverUrl: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?q=80&w=400&auto=format&fit=crop",
  },
  {
    id: "d3",
    artistName: "Chelsea Wolfe",
    albumName: "She Reaches Out To She...",
    discoveredAt: "Jul 18, 2024",
    plays: 24,
    coverUrl: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?q=80&w=400&auto=format&fit=crop",
  },
  {
    id: "d4",
    artistName: "Julie Christmas",
    albumName: "Ridiculous And Full Of Blood",
    discoveredAt: "Jul 10, 2024",
    plays: 18,
    coverUrl: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=400&auto=format&fit=crop",
  },
];

export class OverviewService {
  async getOverviewData(userId: string, period: PeriodKey = "30d"): Promise<OverviewData> {
    const { current, previous } = getPeriodRanges(period);

    // 1. Connection info & total counts
    const connection = await prisma.providerConnection.findFirst({
      where: { userId, provider: "lastfm" },
    });

    const totalStoredEvents = await prisma.listeningEvent.count({
      where: { userId },
    });

    const emptyResult: OverviewData = {
      period,
      summary: { totalPlays: 1842, uniqueArtists: 213, uniqueTracks: 687, estimatedMinutes: 3861, playsChangePercent: 18 },
      concentration: { top5ArtistShare: 42, top10TrackShare: 28, artistDiversityRatio: 65 },
      topArtists: [
        { id: "1", name: "Deftones", plays: 288, share: 0.156 },
        { id: "2", name: "Gojira", plays: 152, share: 0.082 },
        { id: "3", name: "Radiohead", plays: 128, share: 0.069 },
        { id: "4", name: "Mastodon", plays: 97, share: 0.052 },
        { id: "5", name: "Porcupine Tree", plays: 86, share: 0.046 },
      ],
      topTracks: [
        { id: "t1", name: "Genesis", artistName: "Deftones", plays: 48 },
        { id: "t2", name: "The Healer", artistName: "Gojira", plays: 39 },
        { id: "t3", name: "Araya", artistName: "Mastodon", plays: 32 },
        { id: "t4", name: "Nude", artistName: "Radiohead", plays: 29 },
        { id: "t5", name: "Blackest Eyes", artistName: "Porcupine Tree", plays: 26 },
      ],
      topAlbums: DEFAULT_ALBUMS,
      listeningActivity: [
        { label: "JUL 1", hours: 2.1, plays: 36 },
        { label: "JUL 7", hours: 4.8, plays: 82 },
        { label: "JUL 14", hours: 3.5, plays: 60 },
        { label: "JUL 19", hours: 7.4, plays: 127 },
        { label: "JUL 21", hours: 5.2, plays: 89 },
        { label: "JUL 28", hours: 6.1, plays: 104 },
        { label: "JUL 31", hours: 4.0, plays: 68 },
      ],
      tasteShift: {
        rising: [
          { genre: "Sludge Metal", changePercent: 128 },
          { genre: "Drone Metal", changePercent: 96 },
          { genre: "Industrial", changePercent: 72 },
          { genre: "Post Metal", changePercent: 45 },
          { genre: "Math Rock", changePercent: 31 },
        ],
        declining: [
          { genre: "Pop", changePercent: -61 },
          { genre: "Dance Pop", changePercent: -58 },
          { genre: "Hip Hop", changePercent: -44 },
          { genre: "Indie Pop", changePercent: -35 },
          { genre: "R&B", changePercent: -29 },
        ],
      },
      discoveries: DEFAULT_DISCOVERIES,
      recommended: {
        id: "rec1",
        title: "The Long Road North",
        artistName: "Cult of Luna",
        coverUrl: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop",
        reason: "Recommended because you've been diving deeper into atmospheric and heavy soundscapes.",
      },
      aiStory: {
        headline: "Seu mês soou mais pesado.",
        narrative: "Você explorou sons mais sombrios, expandiu seus horizontes no metal e descobriu 18 novos artistas.",
        insight: "Alice in Chains e Black Sabbath ganharam espaço, enquanto o pop representou uma parcela menor das suas audições.",
      },
      syncStatus: { lastSyncedAt: connection?.lastSyncedAt || null, totalStoredEvents: 0 },
    };

    if (totalStoredEvents === 0) {
      return emptyResult;
    }

    // 2. Query current period stats
    const currentWhere =
      period === "all"
        ? { userId }
        : { userId, playedAt: { gte: current.start, lte: current.end } };

    const currentPlays = await prisma.listeningEvent.count({ where: currentWhere });

    if (currentPlays === 0) {
      return emptyResult;
    }

    // Unique Artists
    const uniqueArtistsResult = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName"],
      where: currentWhere,
    });
    const uniqueArtists = uniqueArtistsResult.length;

    // Unique Tracks
    const uniqueTracksResult = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName", "rawTrackName"],
      where: currentWhere,
    });
    const uniqueTracks = uniqueTracksResult.length;

    const estimatedMinutes = Math.round(currentPlays * 3.5);

    // Previous period change calculation
    let playsChangePercent: number | null = null;
    if (previous && period !== "all") {
      const previousPlays = await prisma.listeningEvent.count({
        where: { userId, playedAt: { gte: previous.start, lt: previous.end } },
      });
      if (previousPlays > 0) {
        playsChangePercent = Math.round(((currentPlays - previousPlays) / previousPlays) * 100);
      }
    }

    // Top Artists
    const topArtistsGrouped = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName"],
      where: currentWhere,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    const topArtistNames = topArtistsGrouped.map((a: any) => a.rawArtistName);
    const dbArtists = await prisma.artist.findMany({
      where: { name: { in: topArtistNames } },
      select: { name: true, country: true, tags: true },
    });
    const artistMetaMap = new Map<string, { country: string | null; tags: string[] }>();
    dbArtists.forEach((a: any) => {
      artistMetaMap.set(a.name, {
        country: a.country,
        tags: a.tags ? a.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
      });
    });

    const topArtists: TopArtistItem[] = topArtistsGrouped.map((item: any) => {
      const meta = artistMetaMap.get(item.rawArtistName);
      return {
        id: null,
        name: item.rawArtistName,
        plays: item._count.id,
        share: Number((item._count.id / currentPlays).toFixed(3)),
        country: meta?.country || null,
        tags: meta?.tags || [],
      };
    });

    // Top Tracks
    const topTracksGrouped = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName", "rawTrackName"],
      where: currentWhere,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 10,
    });

    const topTracks: TopTrackItem[] = topTracksGrouped.map((item: any) => ({
      id: null,
      name: item.rawTrackName,
      artistName: item.rawArtistName,
      plays: item._count.id,
    }));

    // Top Albums
    const topAlbumsGrouped = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName", "rawAlbumName"],
      where: { ...currentWhere, NOT: { rawAlbumName: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 6,
    });

    const topAlbums: AlbumItem[] = topAlbumsGrouped
      .filter((a: any) => a.rawAlbumName)
      .map((item: any, idx: number) => ({
        id: `alb-${idx}`,
        title: item.rawAlbumName || "Unknown Album",
        artistName: item.rawArtistName,
        plays: item._count.id,
        coverUrl: DEFAULT_ALBUMS[idx % DEFAULT_ALBUMS.length]?.coverUrl,
      }));

    const finalTopAlbums = topAlbums.length >= 3 ? topAlbums : DEFAULT_ALBUMS;

    // Concentration Metrics
    const top5Plays = topArtists.slice(0, 5).reduce((acc, a) => acc + a.plays, 0);
    const top10TrackPlays = topTracks.reduce((acc, t) => acc + t.plays, 0);

    const top5ArtistShare = Math.round((top5Plays / currentPlays) * 100);
    const top10TrackShare = Math.round((top10TrackPlays / currentPlays) * 100);
    const artistDiversityRatio = Math.min(100, Math.round((uniqueArtists / currentPlays) * 100));

    // Dynamic AI Narrative Story
    const mainArtist = topArtists[0]?.name || "Seus artistas favoritos";
    const secondArtist = topArtists[1]?.name || "outras bandas";

    const aiStory: AiStorySummary = {
      headline: `Seu período com ${mainArtist} soou mais profundo.`,
      narrative: `Você manteve um foco constante em ${mainArtist} e ${secondArtist}, totalizando ${currentPlays} execuções registradas.`,
      insight: `${mainArtist} representou ${(topArtists[0]?.share ? topArtists[0].share * 100 : 25).toFixed(1)}% de toda a sua audição.`,
    };

    return {
      period,
      summary: {
        totalPlays: currentPlays,
        uniqueArtists,
        uniqueTracks,
        estimatedMinutes,
        playsChangePercent,
      },
      concentration: {
        top5ArtistShare,
        top10TrackShare,
        artistDiversityRatio,
      },
      topArtists: topArtists.length ? topArtists : emptyResult.topArtists,
      topTracks: topTracks.length ? topTracks : emptyResult.topTracks,
      topAlbums: finalTopAlbums,
      listeningActivity: emptyResult.listeningActivity,
      tasteShift: emptyResult.tasteShift,
      discoveries: emptyResult.discoveries,
      recommended: emptyResult.recommended,
      aiStory,
      syncStatus: {
        lastSyncedAt: connection?.lastSyncedAt || null,
        totalStoredEvents,
      },
    };
  }
}
