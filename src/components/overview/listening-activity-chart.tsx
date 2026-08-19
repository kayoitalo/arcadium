"use client";

import type { ActivityPoint } from "@/modules/statistics/application/overview-service";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function formatDay(value: string) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ActivityPoint }> }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return <div className="rounded-xl border border-border/80 bg-surface-elevated p-3 text-xs shadow-glow"><p className="font-mono text-accent-gold">{new Date(`${point.label}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}</p><p className="mt-1 font-semibold text-text-primary">{point.plays} audições <span className="font-normal text-text-muted">· cerca de {point.hours}h</span></p></div>;
}

export function ListeningActivityChart({ activity }: { activity: ActivityPoint[] }) {
  const peak = activity.reduce<ActivityPoint | null>((best, item) => !best || item.plays > best.plays ? item : best, null);
  const average = activity.length ? Number((activity.reduce((sum, item) => sum + item.plays, 0) / activity.length).toFixed(1)) : 0;
  return <div className="flex h-[300px] w-full flex-col rounded-3xl border border-border/60 bg-surface/35 p-5 sm:h-[340px]">
    <div className="mb-4 flex items-start justify-between gap-4"><div><span className="eyebrow">ATIVIDADE DE ESCUTA</span><h3 className="mt-1 font-serif text-xl text-text-primary">Quando você mais ouviu</h3><p className="mt-1 text-xs text-text-secondary">A intensidade da sua escuta ao longo do período.</p></div>{peak && <div className="text-right"><span className="block text-[10px] font-mono text-text-muted">MAIOR PICO</span><strong className="text-sm text-accent-gold">{peak.plays} audições</strong><span className="block text-[10px] text-text-muted">{formatDay(peak.label)}</span></div>}</div>
    <div className="min-h-0 flex-1">{activity.length === 0 ? <div className="flex h-full items-center justify-center text-xs text-text-muted">Sem audições no período selecionado.</div> : <ResponsiveContainer width="100%" height="100%"><BarChart data={activity} margin={{ top: 8, right: 4, left: -24, bottom: 0 }}><CartesianGrid vertical={false} stroke="#25201c" strokeDasharray="3 5" /><XAxis dataKey="label" tickFormatter={formatDay} axisLine={false} tickLine={false} minTickGap={28} tick={{ fill: "#776d62", fontSize: 9, fontFamily: "monospace" }} dy={8} /><YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fill: "#776d62", fontSize: 9, fontFamily: "monospace" }} /><Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(180,122,70,.05)" }} /><ReferenceLine y={average} stroke="#c59a60" strokeOpacity={0.4} strokeDasharray="4 5" /><Bar dataKey="plays" fill="#b47a46" radius={[3, 3, 0, 0]} animationDuration={700} activeBar={{ fill: "#c59a60" }} /></BarChart></ResponsiveContainer>}</div>
    {activity.length > 0 && <div className="mt-3 flex items-center gap-2 text-[10px] font-mono text-text-muted"><span className="h-px w-5 border-t border-dashed border-accent-gold/50" />Média de {average} audições nos dias ativos</div>}
  </div>;
}
