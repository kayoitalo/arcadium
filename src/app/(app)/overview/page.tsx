"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, Clock, Disc, Mic, Music, Sparkles } from "lucide-react";
import { PeriodKey, OverviewData } from "@/modules/statistics/application/overview-service";
import type { ProfileNarrative } from "@/modules/ai-analysis/domain/ai-analysis.types";
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

export default function OverviewPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiStory, setAiStory] = useState<ProfileNarrative | null>(null);
  const [loadingAi, setLoadingAi] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null); setLoadingAi(true);
      try {
        const [overview, narrative] = await Promise.all([
          fetch(`/api/overview?period=${period}`),
          fetch(`/api/ai/narrative?period=${period}`),
        ]);
        if (!overview.ok) throw new Error("Não foi possível carregar as estatísticas.");
        setData(await overview.json());
        if (narrative.ok) setAiStory(await narrative.json());
      } catch (err) {
        console.error("Failed to load overview", err);
        setError(err instanceof Error ? err.message : "Não foi possível carregar as estatísticas.");
      } finally { setLoading(false); setLoadingAi(false); }
    }
    load();
  }, [period]);

  const formatHours = (mins: number) => `${Math.floor(mins / 60)}h ${mins % 60}m`;
  const periods: { key: PeriodKey; label: string }[] = [
    { key: "7d", label: "7 dias" }, { key: "30d", label: "30 dias" },
    { key: "1y", label: "1 ano" }, { key: "all", label: "Todo o período" },
  ];
  const headline = aiStory?.headline || data?.aiStory.headline || "Seu histórico musical começa aqui.";
  const narrative = aiStory?.narrative || data?.aiStory.narrative || "Sincronize suas audições para gerar sua análise.";

  if (!loading && error) return <div className="rounded-2xl border border-status-error/30 bg-status-error/10 p-8 text-status-error">{error}</div>;

  return <MotionPage className="pb-12">
    <header className="border-b border-border/60 pb-8">
      <div className="flex flex-col gap-4 border-b border-border/40 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div><span className="eyebrow">SEU MÊS EM MÚSICA</span><p className="mt-1 text-sm text-text-secondary">Analisando os últimos {periods.find((item) => item.key === period)?.label.toLowerCase()}</p></div>
        <div className="flex max-w-full overflow-x-auto rounded-xl border border-border/60 bg-surface p-1">
          {periods.map((item) => <button key={item.key} onClick={() => setPeriod(item.key)} aria-pressed={period === item.key} className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-mono transition-colors ${period === item.key ? "bg-accent/20 font-bold text-accent-gold" : "text-text-secondary hover:text-text-primary"}`}>{item.label}</button>)}
        </div>
      </div>
      <div className="grid gap-8 pt-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(20rem,.7fr)]">
        <AnimatePresence mode="wait"><motion.div key={period} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="flex min-h-64 flex-col justify-center gap-4">
          <span className="eyebrow">{loadingAi ? "LENDO SUA ESCUTA" : aiStory?.eyebrow || "LEITURA DO PERÍODO"}</span>
          <h1 className="max-w-4xl font-serif text-4xl font-medium leading-[.98] tracking-[-.055em] text-text-primary sm:text-5xl xl:text-6xl">{loadingAi ? "Montando seu retrato musical..." : headline}</h1>
          <p className="max-w-2xl text-base leading-relaxed text-text-secondary">{narrative}</p>
          {aiStory?.playfulClosing && <p className="max-w-2xl border-l-2 border-accent-gold/60 pl-4 font-serif text-sm italic text-accent-gold">{aiStory.playfulClosing}</p>}
          {!!aiStory?.tasteKeywords?.length && <div className="flex flex-wrap gap-2">{aiStory.tasteKeywords.map((keyword) => <span key={keyword} className="rounded-full border border-border/70 px-2.5 py-1 text-[10px] font-mono text-text-secondary">{keyword}</span>)}</div>}
        </motion.div></AnimatePresence>
        <PeriodSpotlight album={data?.topAlbums[0]} artist={data?.topArtists[0]} loading={loading} />
      </div>
    </header>

    <MotionSection className="grid gap-3 border-b border-border/60 py-7 sm:grid-cols-3">
      <MetricCard icon={Music} label="AUDIÇÕES" value={loading ? "…" : (data?.summary.totalPlays ?? 0).toLocaleString("pt-BR")} change={data?.summary.playsChangePercent} detail="Eventos registrados no período selecionado." />
      <MetricCard icon={Clock} label="TEMPO DE ESCUTA" value={loading ? "…" : formatHours(data?.summary.listeningMinutes ?? 0)} change={null} detail="Tempo total estimado a partir das durações conhecidas." />
      <MetricCard icon={Mic} label="NOVOS ARTISTAS" value={loading ? "…" : (data?.discoveries.length ?? 0).toLocaleString("pt-BR")} change={null} detail="Artistas que apareceram pela primeira vez no período." />
    </MotionSection>

    {data && <MotionSection className="py-8"><div className="mb-5 flex items-end justify-between gap-4"><div><span className="eyebrow">O QUE SUA ESCUTA REVELA</span><h2 className="mt-1 font-serif text-2xl text-text-primary">Uma leitura além dos números</h2></div><Sparkles className="h-5 w-5 text-accent-gold" /></div><div className="grid gap-4 md:grid-cols-3">{[
      ["Você não ficou preso aos mesmos artistas.", `Seus cinco artistas principais representam ${data.concentration.top5ArtistShare}% das audições.`],
      ["Seu catálogo está se expandindo.", `${data.discoveries.length} descobertas apareceram pela primeira vez neste período.`],
      ["A escuta teve um ritmo próprio.", `${data.listeningActivity.length ? "O gráfico abaixo mostra quando sua música ganhou volume." : "Ainda não há atividade suficiente para identificar um padrão."}`],
    ].map(([title, text]) => <article key={title} className="border-l border-accent/60 bg-surface/25 p-5"><h3 className="font-serif text-lg leading-tight text-text-primary">{title}</h3><p className="mt-3 text-sm leading-relaxed text-text-secondary">{text}</p></article>)}</div></MotionSection>}

    <MotionSection className="grid gap-6 lg:grid-cols-12"><div className="lg:col-span-5"><ListeningActivityChart activity={data?.listeningActivity || []} /></div><div className="lg:col-span-7"><DynamicAlbumHero albums={data?.topAlbums || []} /></div></MotionSection>

    {data && <MotionSection className="grid gap-6 border-y border-border/60 py-8 lg:grid-cols-12"><div className="lg:col-span-7"><EditorialRankings topArtists={data.topArtists || []} /></div><div className="lg:col-span-5"><RecentDiscoveries discoveries={data.discoveries || []} /></div></MotionSection>}

    {data && <MotionSection className="grid gap-6 py-8 lg:grid-cols-12"><div className="lg:col-span-4"><TasteEvolutionCard rising={data.tasteShift.rising || []} declining={data.tasteShift.declining || []} narrativeInsight={aiStory?.insight || data.aiStory.insight} /></div>{data.recommended && <div className="lg:col-span-4"><AlbumRecommendation recommendation={data.recommended} /></div>}<div className="lg:col-span-4"><div className="h-full border border-border/60 bg-surface/25 p-5"><span className="eyebrow">SEU UNIVERSO MUSICAL</span><div className="mt-5 grid grid-cols-2 gap-4">{[["Faixas", data.summary.uniqueTracks], ["Artistas", data.summary.uniqueArtists], ["Top 5", `${data.concentration.top5ArtistShare}%`], ["Diversidade", `${data.concentration.artistDiversityRatio}%`]].map(([label, value]) => <div key={String(label)}><span className="block text-xs text-text-muted">{label}</span><strong className="mt-1 block font-serif text-2xl text-text-primary">{value}</strong></div>)}</div></div></div></MotionSection>}

    {data && <details className="border-t border-border/60 pt-5"><summary className="cursor-pointer list-none text-xs font-mono text-text-muted hover:text-text-primary">Ver detalhes da qualidade dos dados</summary><div className="pt-5"><DataQualityPanel quality={data.dataQuality} /></div></details>}
    <footer className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border/40 pt-4 text-xs font-mono text-text-muted sm:flex-row"><span className="flex items-center gap-2"><Activity className="h-4 w-4 text-status-success" />{data?.syncStatus.totalStoredEvents.toLocaleString() || 0} eventos armazenados</span><span>Sincronizado: {data?.syncStatus.lastSyncedAt ? new Date(data.syncStatus.lastSyncedAt).toLocaleString("pt-BR") : "nunca"}</span></footer>
  </MotionPage>;
}
