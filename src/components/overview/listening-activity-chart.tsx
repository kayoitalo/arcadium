"use client";

import { useState } from "react";
import { ActivityPoint } from "@/modules/statistics/application/overview-service";
import { ChevronDown } from "lucide-react";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from "recharts";

interface ListeningActivityChartProps {
  activity: ActivityPoint[];
}

export function ListeningActivityChart({ activity }: ListeningActivityChartProps) {
  const [viewMode, setViewMode] = useState<"day" | "hour">("day");

  // Recharts custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-surface-elevated border border-border/80 p-3 rounded-lg shadow-glow text-xs font-mono">
          <p className="text-accent-gold font-semibold mb-1">{data.label}</p>
          <p className="text-text-primary font-bold">
            {data.hours}h <span className="text-text-muted font-normal">({data.plays} plays)</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-[320px] sm:h-[380px] md:h-[420px] flex flex-col justify-between p-6 rounded-2xl bg-surface/40 border border-border/60 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
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

      {/* Bar Graph Graphic */}
      <div className="flex-1 w-full min-h-0 relative">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={activity} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <XAxis 
              dataKey="label" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#776d62", fontSize: 10, fontFamily: "monospace" }}
              dy={10}
            />
            <Tooltip 
              content={<CustomTooltip />}
              cursor={{ fill: 'rgba(180, 122, 70, 0.05)' }}
            />
            <Bar 
              dataKey="hours" 
              fill="#b47a46" 
              radius={[2, 2, 0, 0]}
              activeBar={{ fill: '#c59a60', stroke: '#c59a60', strokeWidth: 1 }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
