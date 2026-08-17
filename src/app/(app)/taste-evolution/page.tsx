"use client";

import { useEffect, useState } from "react";
import { Activity, AlertCircle, TrendingDown, TrendingUp } from "lucide-react";
import type { OverviewData, PeriodKey, TasteShiftItem } from "@/modules/statistics/application/overview-service";
import { DataQualityPanel } from "@/components/ui/data-quality-panel";
import { MotionDiv, MotionPage, MotionSection } from "@/components/ui/motion";

function ShiftList({ title, items, direction }: { title: string; items: TasteShiftItem[]; direction: "up" | "down" }) {
  const Icon = direction === "up" ? TrendingUp : TrendingDown;
  return (
    <section className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-4">
      <div className="flex items-center gap-2 border-b border-border/50 pb-3">
        <Icon className={`w-4 h-4 ${direction === "up" ? "text-status-success" : "text-status-error"}`} />
        <h2 className="text-xs font-mono font-bold tracking-wider text-text-primary uppercase">{title}</h2>
      </div>
      {items.length ? <div className="space-y-3">{items.map((item) => (
        <div key={item.genre} className="rounded-xl border border-border/40 bg-surface-elevated/40 p-3">
          <div className="flex items-center justify-between"><span className="text-sm capitalize text-text-primary">{item.genre}</span><strong className={direction === "up" ? "text-status-success" : "text-status-error"}>{item.changePercent > 0 ? "+" : ""}{item.changePercent}%</strong></div>
          <div className="mt-3 grid grid-cols-[4rem_1fr_2.5rem] items-center gap-2 text-[10px] font-mono text-text-muted"><span>Anterior</span><div className="h-1.5 rounded-full bg-background"><div className="h-full rounded-full bg-text-muted" style={{ width: `${Math.min(100, item.previousShare)}%` }} /></div><span className="text-right">{item.previousShare}%</span></div>
          <div className="mt-1.5 grid grid-cols-[4rem_1fr_2.5rem] items-center gap-2 text-[10px] font-mono text-text-secondary"><span>Atual</span><div className="h-1.5 rounded-full bg-background"><div className={`h-full rounded-full ${direction === "up" ? "bg-status-success" : "bg-status-error"}`} style={{ width: `${Math.min(100, item.currentShare)}%` }} /></div><span className="text-right">{item.currentShare}%</span></div>
        </div>
      ))}</div> : <p className="text-xs text-text-muted leading-relaxed">Nenhuma variação de gênero pôde ser calculada para este período.</p>}
    </section>
  );
}

export default function TasteEvolutionPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/overview?period=${period}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar a evolução de gosto.");
        return response.json();
      })
      .then(setData)
      .catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [period]);

  const hasShift = Boolean(data?.tasteShift.rising.length || data?.tasteShift.declining.length);
  return (
    <MotionPage className="space-y-8 pb-16">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 border-b border-border/40 pb-5">
        <div>
          <span className="text-[10px] font-mono tracking-[0.2em] text-text-muted uppercase">Comparação com o período anterior</span>
          <h1 className="font-serif text-4xl text-text-primary mt-2">Evolução do gosto</h1>
        </div>
        <div className="flex p-1 rounded-xl bg-surface border border-border/60">
          {([{ key: "30d", label: "30 dias" }, { key: "1y", label: "1 ano" }] as const).map((option) => (
            <button key={option.key} onClick={() => setPeriod(option.key)} className={`px-4 py-2 rounded-lg text-xs font-mono ${period === option.key ? "bg-accent/20 text-accent-gold border border-accent/40" : "text-text-secondary"}`}>{option.label}</button>
          ))}
        </div>
      </header>
      {loading && <div className="p-8 rounded-2xl bg-surface/40 border border-border/60 text-sm text-text-muted">Calculando a partir do histórico armazenado…</div>}
      {error && <div className="p-5 rounded-2xl bg-status-error/10 border border-status-error/30 text-status-error flex gap-3"><AlertCircle className="w-5 h-5" />{error}</div>}
      {!loading && !error && data && <>
        <MotionSection className="p-6 rounded-2xl bg-surface/40 border border-border/60 flex gap-4 items-start">
          <Activity className="w-5 h-5 text-accent-gold mt-0.5" />
          <div><h2 className="text-sm font-semibold text-text-primary">Base da análise</h2><p className="text-xs text-text-secondary mt-1">{data.summary.totalPlays} audições, {data.summary.uniqueArtists} artistas e {data.summary.uniqueTracks} faixas no período selecionado.</p></div>
        </MotionSection>
        <MotionDiv><DataQualityPanel quality={data.dataQuality} /></MotionDiv>
        {!hasShift && <MotionSection className="p-8 rounded-2xl bg-surface/40 border border-border/60 text-center"><h2 className="font-serif text-2xl text-text-primary">Dados de gênero insuficientes</h2><p className="text-sm text-text-secondary mt-2 max-w-xl mx-auto">A comparação será exibida quando houver artistas enriquecidos com tags nos períodos atual e anterior. Continue o enriquecimento em Configurações.</p></MotionSection>}
        <MotionDiv className="grid grid-cols-1 lg:grid-cols-2 gap-6"><ShiftList title="Gêneros em ascensão" items={data.tasteShift.rising} direction="up" /><ShiftList title="Gêneros em queda" items={data.tasteShift.declining} direction="down" /></MotionDiv>
      </>}
    </MotionPage>
  );
}
