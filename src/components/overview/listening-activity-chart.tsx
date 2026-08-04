"use client";

import { useState } from "react";
import { ActivityPoint } from "@/modules/statistics/application/overview-service";
import { ChevronDown } from "lucide-react";

interface ListeningActivityChartProps {
  activity: ActivityPoint[];
}

export function ListeningActivityChart({ activity }: ListeningActivityChartProps) {
  const [activeHover, setActiveHover] = useState<ActivityPoint | null>(null);
  const [viewMode, setViewMode] = useState<"day" | "hour">("day");

  const maxHours = Math.max(...activity.map((a) => a.hours), 8);

  return (
    <div className="w-full h-[320px] sm:h-[380px] md:h-[420px] flex flex-col justify-between p-6 rounded-2xl bg-surface/40 border border-border/60 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-mono font-bold tracking-[0.2em] text-text-muted uppercase block">
            LISTENING ACTIVITY
          </span>
          <h3 className="font-serif text-lg font-bold text-text-primary">
            Hourly Volume
          </h3>
        </div>

        {/* Dropdown Selector */}
        <div className="relative inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-surface border border-border/80 text-xs text-text-secondary hover:text-text-primary transition-colors cursor-pointer">
          <span className="font-mono text-[11px]">By {viewMode}</span>
          <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
        </div>
      </div>

      {/* Hover Info Tooltip Bar */}
      <div className="h-6 flex items-center justify-between text-xs font-mono px-2 my-2">
        {activeHover ? (
          <>
            <span className="text-accent-gold font-semibold">{activeHover.label}</span>
            <span className="text-text-primary font-bold">{activeHover.hours}h ({activeHover.plays} plays)</span>
          </>
        ) : (
          <span className="text-text-muted text-[11px]">Hover over bars to inspect daily listening output</span>
        )}
      </div>

      {/* Bar Graph Graphic */}
      <div className="flex-1 flex items-end justify-between gap-1.5 sm:gap-3 pt-4 border-b border-border/60 relative">
        {/* Subtle Horizontal Reference Grid Lines */}
        <div className="absolute inset-x-0 top-0 border-b border-border/30 border-dashed pointer-events-none" />
        <div className="absolute inset-x-0 top-1/2 border-b border-border/30 border-dashed pointer-events-none" />

        {activity.map((item, idx) => {
          const heightPercent = Math.min(100, Math.max(10, (item.hours / maxHours) * 100));
          const isHovered = activeHover?.label === item.label;

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
              onMouseEnter={() => setActiveHover(item)}
              onMouseLeave={() => setActiveHover(null)}
            >
              {/* Vertical Bar */}
              <div
                className={`w-full max-w-[20px] rounded-t-sm transition-all duration-300 ${
                  isHovered
                    ? "bg-accent-gold shadow-[0_0_15px_rgba(197,154,96,0.5)] scale-y-[1.03]"
                    : "bg-accent/40 group-hover:bg-accent group-hover:shadow-glow"
                }`}
                style={{ height: `${heightPercent}%` }}
              />
            </div>
          );
        })}
      </div>

      {/* X-Axis Labels */}
      <div className="flex justify-between items-center text-[10px] font-mono text-text-muted pt-3">
        {activity.map((item, idx) => (
          <span key={idx} className="truncate">
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
