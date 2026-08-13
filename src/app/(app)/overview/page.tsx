"use client";

import { useEffect, useState } from "react";
import { PeriodKey, OverviewData } from "@/modules/statistics/application/overview-service";
import { DynamicAlbumHero } from "@/components/overview/dynamic-album-hero";
import { ListeningActivityChart } from "@/components/overview/listening-activity-chart";
import { EditorialRankings } from "@/components/overview/editorial-rankings";
import { RecentDiscoveries } from "@/components/overview/recent-discoveries";
import { TasteEvolutionCard } from "@/components/overview/taste-evolution-card";
import { AlbumRecommendation } from "@/components/overview/album-recommendation";
import {
  Music,
  Mic,
  Clock,
  Disc,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  Activity,
  Layers,
} from "lucide-react";

export default function OverviewPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiStory, setAiStory] = useState<{ headline: string; narrative: string; insight: string } | null>(null);
  const [loadingAi, setLoadingAi] = useState(true);

  useEffect(() => {
    async function fetchOverview() {
      setLoading(true);
      try {
        const res = await fetch(`/api/overview?period=${period}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to load overview data", err);
      } finally {
        setLoading(false);
      }
    }

    async function fetchAiNarrative() {
      setLoadingAi(true);
      try {
        const res = await fetch(`/api/ai/narrative?period=${period}`);
        if (res.ok) {
          const json = await res.json();
          setAiStory(json);
        }
      } catch (err) {
        console.error("Failed to load AI narrative", err);
      } finally {
        setLoadingAi(false);
      }
    }

    fetchOverview();
    fetchAiNarrative();
  }, [period]);

  const formatHours = (mins: number) => {
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const periods: { key: PeriodKey; label: string }[] = [
    { key: "7d", label: "7 Days" },
    { key: "30d", label: "30 Days" },
    { key: "1y", label: "1 Year" },
    { key: "all", label: "All Time" },
  ];

  return (
    <div className="space-y-10 pb-12">
      {/* Editorial Masthead / Header */}
      <header className="space-y-6">
        {/* Top Controls Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-text-muted uppercase">
              YOUR MONTHLY REVIEW
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Period Selector Pills */}
            <div className="flex p-1 rounded-xl bg-surface border border-border/60">
              {periods.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
                    period === p.key
                      ? "bg-accent/20 text-accent-gold font-bold border border-accent/40 shadow-glow"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Navigation Arrows */}
            <div className="flex items-center gap-1">
              <button className="p-2 rounded-lg border border-border/60 bg-surface text-text-secondary hover:text-text-primary transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="p-2 rounded-lg border border-border/60 bg-surface text-text-secondary hover:text-text-primary transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Narrative Headline & Story Callout */}
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-normal leading-[1.05] tracking-tight text-text-primary">
              {loadingAi ? (
                <span className="h-12 w-64 bg-surface/40 animate-pulse rounded-lg inline-block"></span>
              ) : (
                aiStory?.headline || "Your month sounded heavier."
              )}
            </h1>
            <p className="text-text-secondary text-sm sm:text-base leading-relaxed font-sans max-w-xl">
              {loadingAi ? (
                <span className="h-4 w-96 bg-surface/40 animate-pulse rounded inline-block"></span>
              ) : (
                aiStory?.narrative || "You explored darker sounds, expanded your metal horizons, and discovered 18 new artists."
              )}
            </p>
          </div>

          <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-surface border border-accent/40 text-accent-gold text-xs font-mono font-bold hover:bg-accent/20 transition-all shadow-glow flex-shrink-0">
            <span>EXPLORE YOUR MONTH</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Hero Section: 2.5D Collage + Listening Activity Chart */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 flex">
          <DynamicAlbumHero albums={data?.topAlbums || []} />
        </div>
        <div className="lg:col-span-5 flex">
          <ListeningActivityChart activity={data?.listeningActivity || []} />
        </div>
      </section>

      {/* Primary Metrics Bar */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 rounded-2xl bg-surface/30 border border-border/50">
        {/* Metric 1: Scrobbles */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-text-muted">
            <Music className="w-4 h-4 text-accent-gold" />
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase">PLAYS</span>
          </div>
          <div className="font-serif text-3xl sm:text-4xl font-bold text-text-primary">
            {loading ? "..." : data?.summary.totalPlays.toLocaleString() || "1,842"}
          </div>
          <div className="text-[11px] font-mono text-status-success flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            <span>+{data?.summary.playsChangePercent || 18}% vs prev period</span>
          </div>
        </div>

        {/* Metric 2: Artists */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-text-muted">
            <Mic className="w-4 h-4 text-accent-gold" />
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase">ARTISTS</span>
          </div>
          <div className="font-serif text-3xl sm:text-4xl font-bold text-text-primary">
            {loading ? "..." : data?.summary.uniqueArtists.toLocaleString() || "213"}
          </div>
          <div className="text-[11px] font-mono text-status-success flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            <span>+23% vs prev period</span>
          </div>
        </div>

        {/* Metric 3: Tracks */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-text-muted">
            <Disc className="w-4 h-4 text-accent-gold" />
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase">TRACKS</span>
          </div>
          <div className="font-serif text-3xl sm:text-4xl font-bold text-text-primary">
            {loading ? "..." : data?.summary.uniqueTracks.toLocaleString() || "687"}
          </div>
          <div className="text-[11px] font-mono text-status-success flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            <span>+15% vs prev period</span>
          </div>
        </div>

        {/* Metric 4: Listening Time */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-text-muted">
            <Clock className="w-4 h-4 text-accent-gold" />
            <span className="text-[10px] font-mono font-bold tracking-wider uppercase">LISTENING TIME</span>
          </div>
          <div className="font-serif text-3xl sm:text-4xl font-bold text-text-primary">
            {loading ? "..." : formatHours(data?.summary.estimatedMinutes || 3861)}
          </div>
          <div className="text-[11px] font-mono text-status-success flex items-center gap-1">
            <ArrowUpRight className="w-3 h-3" />
            <span>+12% vs prev period</span>
          </div>
        </div>
      </section>

      {/* Main 4-Column Editorial Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <EditorialRankings topArtists={data?.topArtists || []} />
        <RecentDiscoveries discoveries={data?.discoveries || []} />
        <TasteEvolutionCard
          rising={data?.tasteShift.rising || []}
          declining={data?.tasteShift.declining || []}
          narrativeInsight={aiStory?.insight}
        />
        {data?.recommended && <AlbumRecommendation recommendation={data.recommended} />}
      </section>

      {/* Listening History Table Section */}
      <section className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-6">
        <div className="flex items-center justify-between border-b border-border/50 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-text-muted uppercase">
              LISTENING HISTORY
            </span>
          </div>
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-border/80 text-xs font-mono text-text-secondary hover:text-text-primary transition-colors">
            <Filter className="w-3.5 h-3.5 text-text-muted" />
            <span>FILTER</span>
          </button>
        </div>

        {/* History Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="text-[10px] font-mono uppercase text-text-muted border-b border-border/60">
              <tr>
                <th className="py-3 px-4 w-12">#</th>
                <th className="py-3 px-4">TRACK</th>
                <th className="py-3 px-4">ARTIST</th>
                <th className="py-3 px-4">ALBUM</th>
                <th className="py-3 px-4">LISTENED</th>
                <th className="py-3 px-4 text-right">TIME</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {(data?.topTracks || []).slice(0, 5).map((track, idx) => (
                <tr key={idx} className="hover:bg-surface-elevated/50 transition-colors group">
                  <td className="py-3.5 px-4 font-mono text-text-muted">{idx + 1}</td>
                  <td className="py-3.5 px-4 font-semibold text-text-primary group-hover:text-accent-gold transition-colors">
                    {track.name}
                  </td>
                  <td className="py-3.5 px-4 text-text-secondary">{track.artistName}</td>
                  <td className="py-3.5 px-4 text-text-muted font-mono">
                    {data?.topAlbums[idx % data.topAlbums.length]?.title || "Album"}
                  </td>
                  <td className="py-3.5 px-4 text-text-muted font-mono">
                    Jul 31, 2024 9:41 PM
                  </td>
                  <td className="py-3.5 px-4 text-right text-text-muted font-mono">
                    4:15
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Sync Status Observability Footer */}
      <footer className="p-4 rounded-xl bg-surface/30 border border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted font-mono">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-status-success animate-pulse" />
          <span>Total Database Events: </span>
          <strong className="text-text-primary">{data?.syncStatus.totalStoredEvents.toLocaleString() || 0}</strong>
        </div>
        <div>
          <span>Last Sync: </span>
          <strong className="text-text-primary">
            {data?.syncStatus.lastSyncedAt
              ? new Date(data.syncStatus.lastSyncedAt).toLocaleString("pt-BR")
              : "Active"}
          </strong>
        </div>
      </footer>
    </div>
  );
}
