"use client";

import { RecommendationItem } from "@/modules/statistics/application/overview-service";
import { Play, Bookmark, MoreHorizontal } from "lucide-react";

interface AlbumRecommendationProps {
  recommendation: RecommendationItem;
}

export function AlbumRecommendation({ recommendation }: AlbumRecommendationProps) {
  return (
    <div className="p-6 rounded-2xl bg-surface/40 border border-border/60 flex flex-col justify-between space-y-4">
      {/* Header */}
      <div>
        <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-text-muted uppercase block">
          RECOMMENDED FOR YOU
        </span>
        <span className="text-[10px] font-mono text-text-secondary uppercase tracking-wider block">
          BASED ON YOUR TASTE EVOLUTION
        </span>
      </div>

      {/* Featured Album Card */}
      <div className="relative rounded-xl overflow-hidden border border-border/70 group shadow-magazine aspect-square max-h-[260px] mx-auto w-full">
        <img
          src={recommendation.coverUrl}
          alt={recommendation.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

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

          {/* Action Row */}
          <div className="flex items-center justify-between mt-4">
            <button className="flex items-center gap-2 px-4 py-2 rounded-full bg-text-primary text-background font-mono text-xs font-bold hover:bg-accent-gold transition-colors shadow-glow">
              <Play className="w-3.5 h-3.5 fill-background" />
              <span>PLAY ALBUM</span>
            </button>
            <div className="flex items-center gap-2 text-text-secondary">
              <button className="p-1.5 hover:text-text-primary transition-colors">
                <Bookmark className="w-4 h-4" />
              </button>
              <button className="p-1.5 hover:text-text-primary transition-colors">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Carousel Navigation Dots */}
      <div className="flex items-center justify-center gap-1.5 pt-2">
        <span className="w-2 h-2 rounded-full bg-accent-gold" />
        <span className="w-1.5 h-1.5 rounded-full bg-border" />
        <span className="w-1.5 h-1.5 rounded-full bg-border" />
        <span className="w-1.5 h-1.5 rounded-full bg-border" />
      </div>
    </div>
  );
}
