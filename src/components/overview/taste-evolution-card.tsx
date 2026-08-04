"use client";

import { TasteShiftItem } from "@/modules/statistics/application/overview-service";
import { Info, TrendingUp, TrendingDown } from "lucide-react";

interface TasteEvolutionCardProps {
  rising: TasteShiftItem[];
  declining: TasteShiftItem[];
  narrativeInsight?: string;
}

export function TasteEvolutionCard({ rising, declining, narrativeInsight }: TasteEvolutionCardProps) {
  return (
    <div className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-6 flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/50 pb-3 mb-5">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-text-muted uppercase">
              TASTE SHIFT
            </span>
            <Info className="w-3.5 h-3.5 text-text-muted" />
          </div>
        </div>

        {/* Rising Genres */}
        <div className="space-y-2 mb-6">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-text-muted block">
            RISING GENRES
          </span>
          <div className="space-y-1.5">
            {rising.slice(0, 5).map((item) => (
              <div key={item.genre} className="flex items-center justify-between text-xs font-mono">
                <span className="text-text-primary font-medium">{item.genre}</span>
                <span className="text-status-success font-semibold flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  +{item.changePercent}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Declining Genres */}
        <div className="space-y-2">
          <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-text-muted block">
            DECLINING GENRES
          </span>
          <div className="space-y-1.5">
            {declining.slice(0, 5).map((item) => (
              <div key={item.genre} className="flex items-center justify-between text-xs font-mono">
                <span className="text-text-secondary">{item.genre}</span>
                <span className="text-status-error font-semibold flex items-center gap-1">
                  <TrendingDown className="w-3 h-3" />
                  {item.changePercent}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Narrative Commentary */}
      {narrativeInsight && (
        <div className="p-3.5 rounded-xl bg-surface-soft border border-border/60 text-xs text-text-secondary italic font-serif leading-relaxed mt-4">
          "{narrativeInsight}"
        </div>
      )}
    </div>
  );
}
