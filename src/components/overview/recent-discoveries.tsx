"use client";

import { DiscoveryItem } from "@/modules/statistics/application/overview-service";
import { ArrowUpRight } from "lucide-react";

interface RecentDiscoveriesProps {
  discoveries: DiscoveryItem[];
}

export function RecentDiscoveries({ discoveries }: RecentDiscoveriesProps) {
  return (
    <div className="p-6 rounded-2xl bg-surface/40 border border-border/60 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-text-muted uppercase">
          RECENT DISCOVERIES
        </span>
        <button className="text-xs font-mono text-accent-gold hover:text-accent flex items-center gap-1 transition-colors">
          <span>SEE ALL</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* List */}
      <div className="space-y-4">
        {discoveries.slice(0, 4).map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3.5 p-2 rounded-xl hover:bg-surface-elevated/60 transition-all group cursor-pointer"
          >
            {/* Cover image */}
            <div className="w-11 h-11 rounded-lg overflow-hidden border border-border/60 flex-shrink-0 bg-surface-soft shadow-card">
              <img
                src={item.coverUrl}
                alt={item.artistName}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            </div>

            {/* Meta */}
            <div className="min-w-0 flex-1">
              <span className="text-sm font-semibold text-text-primary block truncate group-hover:text-accent-gold transition-colors">
                {item.artistName}
              </span>
              <span className="text-xs text-text-secondary block truncate">
                {item.albumName}
              </span>
              <span className="text-[10px] text-text-muted font-mono block">
                discovered {item.discoveredAt}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
