"use client";

import { useEffect, useState } from "react";
import { PeriodKey, OverviewData } from "@/modules/statistics/application/overview-service";
import { DynamicAlbumHero } from "@/components/overview/dynamic-album-hero";
import { ListeningActivityChart } from "@/components/overview/listening-activity-chart";
import { PeriodSpotlight } from "@/components/overview/period-spotlight";
import { EditorialRankings } from "@/components/overview/editorial-rankings";
import { RecentDiscoveries } from "@/components/overview/recent-discoveries";
import { TasteEvolutionCard } from "@/components/overview/taste-evolution-card";
import { AlbumRecommendation } from "@/components/overview/album-recommendation";
import { DataQualityPanel } from "@/components/ui/data-quality-panel";
import { MetricCard } from "@/components/ui/metric-card";
import { MotionPage, MotionSection } from "@/components/ui/motion";
import type { ProfileNarrative } from "@/modules/ai-analysis/domain/ai-analysis.types";
import { AnimatePresence, motion } from "framer-motion";
import {
  Music,
  Mic,
  Clock,
  Disc,
  Activity,
} from "lucide-react";

export default function OverviewPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiStory, setAiStory] = useState<ProfileNarrative | null>(null);
  const [loadingAi, setLoadingAi] = useState(true);

  useEffect(() => {
    async function fetchOverview() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/overview?period=${period}`);
        if (!res.ok) throw new Error("Não foi possível carregar as estatísticas.");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Failed to load overview data", err);
        setError(err instanceof Error ? err.message : "Não foi possível carregar as estatísticas.");
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
    { key: "7d", label: "7 dias" },
    { key: "30d", label: "30 dias" },
    { key: "1y", label: "1 ano" },
    { key: "all", label: "Todo o período" },
  ];

  if (!loading && error) {
    return <div className="p-8 rounded-2xl bg-status-error/10 border border-status-error/30 text-status-error">{error}</div>;
  }

  return (
    <MotionPage className="space-y-10 pb-12">

      <header className="space-y-6">

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono font-bold tracking-[0.25em] text-text-muted uppercase">
              PERÍODO ANALISADO: {periods.find((item) => item.key === period)?.label.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center gap-3">

            <div className="flex max-w-full overflow-x-auto rounded-xl border border-border/60 bg-surface p-1">
              {periods.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  aria-pressed={period === p.key}
                  className={`whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
                    period === p.key
                      ? "bg-accent/20 text-accent-gold font-bold border border-accent/40 shadow-glow"
                      : "text-text-secondary hover:text-text-primary"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

          </div>
        </div>

        <div className="grid items-stretch gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,.65fr)]">
          <AnimatePresence mode="wait"><motion.div key={period} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }} className="flex min-h-64 flex-col justify-center space-y-3 py-3">
            {!loadingAi && aiStory?.eyebrow && <span className="eyebrow">{aiStory.eyebrow}</span>}
            <h1 className="max-w-4xl font-serif text-4xl font-medium leading-[0.98] tracking-[-0.055em] text-text-primary sm:text-5xl xl:text-6xl">
              {loadingAi ? (
                <span className="h-12 w-64 bg-surface/40 animate-pulse rounded-lg inline-block"></span>
              ) : (
                aiStory?.headline || data?.aiStory.headline || "Seu histórico musical começa aqui."
              )}
            </h1>
            <p className="max-w-3xl text-sm leading-relaxed text-text-secondary sm:text-base">
              {loadingAi ? (
                <span className="h-4 w-96 bg-surface/40 animate-pulse rounded inline-block"></span>
              ) : (
                aiStory?.narrative || data?.aiStory.narrative || "Sincronize suas audições para gerar sua análise."
              )}
            </p>
            {!loadingAi && aiStory?.playfulClosing && <p className="border-l-2 border-accent-gold/60 pl-3 font-serif text-sm italic text-accent-gold">{aiStory.playfulClosing}</p>}
            {!loadingAi && Boolean(aiStory?.tasteKeywords?.length) && <div className="flex flex-wrap gap-2 pt-1">{aiStory?.tasteKeywords?.map((keyword) => <span key={keyword} className="rounded-full border border-border/70 bg-surface/50 px-2.5 py-1 text-[10px] font-mono text-text-secondary">{keyword}</span>)}</div>}
          </motion.div></AnimatePresence>
          <PeriodSpotlight album={data?.topAlbums[0]} artist={data?.topArtists[0]} loading={loading} />
        </div>
      </header>

      <MotionSection className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Music} label="AUDIÇÕES" value={loading ? "…" : (data?.summary.totalPlays ?? 0).toLocaleString("pt-BR")} change={data?.summary.playsChangePercent} detail="Eventos registrados no período selecionado." />
        <MetricCard icon={Mic} label="ARTISTAS" value={loading ? "…" : (data?.summary.uniqueArtists ?? 0).toLocaleString("pt-BR")} change={data?.summary.artistsChangePercent} detail="Artistas distintos, agrupados pelo nome registrado pelo provedor." />
        <MetricCard icon={Disc} label="FAIXAS" value={loading ? "…" : (data?.summary.uniqueTracks ?? 0).toLocaleString("pt-BR")} change={data?.summary.tracksChangePercent} detail="Combinações distintas de artista e faixa." />
        <MetricCard icon={Clock} label="TEMPO DE ESCUTA" value={loading ? "…" : formatHours(data?.summary.listeningMinutes ?? 0)} change={null} detail={data?.summary.durationSource === "TRACK_METADATA" ? "Calculado com a duração armazenada de todas as faixas." : "Combina durações conhecidas com estimativa de 3,5 minutos para faixas sem duração."} />
      </MotionSection>

      <MotionSection className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 flex">
          <DynamicAlbumHero albums={data?.topAlbums || []} />
        </div>
        <div className="lg:col-span-5 flex">
          <ListeningActivityChart activity={data?.listeningActivity || []} />
        </div>
      </MotionSection>

      {data && <MotionSection><DataQualityPanel quality={data.dataQuality} /></MotionSection>}

      {data && <MotionSection className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          ["Concentração nos 5 artistas", data.concentration.top5ArtistShare, "Parcela das audições concentrada nos cinco artistas mais ouvidos."],
          ["Concentração nas 10 faixas", data.concentration.top10TrackShare, "Parcela das audições concentrada nas dez faixas mais ouvidas."],
          ["Diversidade de artistas", data.concentration.artistDiversityRatio, "Relação entre artistas distintos e total de audições."],
        ].map(([label, value, detail]) => <article key={String(label)} className="rounded-2xl border border-border/60 bg-surface/30 p-5" title={String(detail)}><span className="eyebrow">{label}</span><strong className="mt-2 block font-serif text-3xl text-text-primary">{value}%</strong><div className="mt-3 h-1.5 rounded-full bg-background"><div className="h-full rounded-full bg-accent-gold" style={{ width: `${value}%` }} /></div></article>)}
      </MotionSection>}

      <MotionSection className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <EditorialRankings topArtists={data?.topArtists || []} />
        <RecentDiscoveries discoveries={data?.discoveries || []} />
        <TasteEvolutionCard
          rising={data?.tasteShift.rising || []}
          declining={data?.tasteShift.declining || []}
          narrativeInsight={aiStory?.insight || data?.aiStory.insight}
        />
        {data?.recommended && <AlbumRecommendation recommendation={data.recommended} />}
      </MotionSection>

      <footer className="p-4 rounded-xl bg-surface/30 border border-border/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted font-mono">
        <div className="flex items-center gap-2">
          <Activity className={`w-4 h-4 ${data?.syncStatus.lastSyncedAt ? "text-status-success" : "text-text-muted"}`} />
          <span>Total de eventos no banco: </span>
          <strong className="text-text-primary">{data?.syncStatus.totalStoredEvents.toLocaleString() || 0}</strong>
        </div>
        <div>
          <span>Última sincronização: </span>
          <strong className="text-text-primary">
            {data?.syncStatus.lastSyncedAt
              ? new Date(data.syncStatus.lastSyncedAt).toLocaleString("pt-BR")
              : "Nunca sincronizado"}
          </strong>
        </div>
      </footer>
    </MotionPage>
  );
}
