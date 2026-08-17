"use client";

import { RecommendationItem } from "@/modules/statistics/application/overview-service";
import { ResilientCover } from "@/components/ui/resilient-cover";

interface AlbumRecommendationProps {
  recommendation: RecommendationItem;
}

export function AlbumRecommendation({ recommendation }: AlbumRecommendationProps) {
  return (
    <div className="p-6 rounded-2xl bg-surface/40 border border-border/60 flex flex-col justify-between space-y-4">
      {/* Header */}
      <div>
        <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-text-muted uppercase block">
          RECOMENDADO PARA VOCÊ
        </span>
        <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider block">
          ÚLTIMA SESSÃO ARMAZENADA
        </span>
      </div>

      {/* Featured Album Card */}
      <div className="relative rounded-xl overflow-hidden border border-border/70 group shadow-magazine aspect-square max-h-[260px] mx-auto w-full">
        <ResilientCover src={recommendation.coverUrl} alt={recommendation.title} label={recommendation.title} className="h-full w-full" imageClassName="transition-transform duration-500 group-hover:scale-105" />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent p-5 flex flex-col justify-end">
          <h4 className="font-serif text-lg font-bold text-text-primary leading-snug">
            {recommendation.artistName}
          </h4>
          <p className="text-xs font-semibold text-accent-gold font-mono">
            {recommendation.title}
          </p>
          <p className="text-[11px] text-text-secondary line-clamp-2 mt-2 leading-relaxed font-sans">
            {recommendation.reason}
          </p>

        </div>
      </div>

    </div>
  );
}
