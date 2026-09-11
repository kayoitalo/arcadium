"use client";

import { useMemo, useState } from "react";
import { LedColumns } from "@/components/ui/led-columns";
import type { ActivityPoint } from "@/modules/statistics/application/overview-service";

type Unit = "day" | "week" | "month";

interface Bucket {
  start: string;
  plays: number;
}

/** Altura do espectro em segmentos de LED. */
const SEGMENTS = 24;

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const UNIT_NOTE: Record<Unit, string> = {
  day: "1 coluna = 1 dia",
  week: "1 coluna = 1 semana",
  month: "1 coluna = 1 mês",
};

const dayKey = (date: Date) => date.toISOString().slice(0, 10);

function formatBucket(iso: string, unit: Unit, withYear: boolean): string {
  const [year, month, day] = iso.split("-");
  const monthName = MONTHS[Number(month) - 1];
  if (unit === "month") return `${monthName} ${year}`;
  const base = `${Number(day)} ${monthName}${withYear ? ` ${year}` : ""}`;
  return unit === "week" ? `semana de ${base}` : base;
}

/**
 * Preenche os dias sem escuta com zero e agrupa até caber: dia a dia
 * até dois meses, semana até dois anos, mês depois disso. Silêncio é
 * uma coluna apagada, não um buraco no eixo.
 */
export function buildBuckets(activity: ActivityPoint[], days: number | null, today = new Date()) {
  const plays = new Map<string, number>();
  for (const point of activity) plays.set(point.label.slice(0, 10), point.plays);

  const labels = [...plays.keys()].sort();
  if (labels.length === 0) return { buckets: [] as Bucket[], unit: "day" as Unit, spanDays: 0 };

  const end = new Date(`${dayKey(today)}T00:00:00Z`);
  const start = days
    ? new Date(end.getTime() - (days - 1) * 86_400_000)
    : new Date(`${labels[0]}T00:00:00Z`);
  const spanDays = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const unit: Unit = spanDays <= 62 ? "day" : spanDays <= 730 ? "week" : "month";

  const buckets: Bucket[] = [];
  let currentKey = "";
  for (let offset = 0; offset < spanDays; offset += 1) {
    const date = new Date(start.getTime() + offset * 86_400_000);
    const iso = dayKey(date);
    const key = unit === "day" ? iso : unit === "week" ? String(Math.floor(offset / 7)) : iso.slice(0, 7);

    if (key !== currentKey) {
      buckets.push({ start: iso, plays: 0 });
      currentKey = key;
    }
    buckets[buckets.length - 1].plays += plays.get(iso) ?? 0;
  }

  return { buckets, unit, spanDays };
}

/**
 * O analisador de espectro: cada coluna é um trecho do período e a
 * altura é o volume de audições, em segmentos de LED. O pico fica
 * aceso em branco; passar o cursor lê qualquer coluna.
 */
export function Spectrum({ activity, days }: { activity: ActivityPoint[]; days: number | null }) {
  const { buckets, unit, spanDays } = useMemo(() => buildBuckets(activity, days), [activity, days]);
  const [hovered, setHovered] = useState<number | null>(null);

  const total = buckets.reduce((sum, bucket) => sum + bucket.plays, 0);

  if (buckets.length < 2 || total === 0) {
    return (
      <div className="flex h-[180px] items-center border border-border bg-well px-5">
        <p className="data text-text-muted">O espectro aparece quando houver ao menos dois dias de escuta.</p>
      </div>
    );
  }

  const max = Math.max(1, ...buckets.map((bucket) => bucket.plays));
  const peak = buckets.findIndex((bucket) => bucket.plays === max);
  const shown = hovered ?? peak;
  const withYear = spanDays > 330;

  return (
    <div className="border border-border bg-well">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule px-4 py-2.5">
        <span className="data text-text-secondary">
          <span className="text-text-muted">{hovered === null ? "pico · " : ""}</span>
          {formatBucket(buckets[shown].start, unit, withYear)}
        </span>
        <span className="data">
          <b className="text-[13px] font-semibold text-text-primary">
            {buckets[shown].plays.toLocaleString("pt-BR")}
          </b>
          <span className="text-text-muted"> audições</span>
        </span>
      </div>

      <div
        role="img"
        aria-label={`Espectro de audições: pico de ${max} em ${formatBucket(buckets[peak].start, unit, withYear)}`}
        className="px-4 pt-5"
      >
        <LedColumns
          values={buckets.map((bucket) => bucket.plays)}
          columnKeys={buckets.map((bucket) => `${unit}-${bucket.start}`)}
          hot={shown}
          segments={SEGMENTS}
          onHover={setHovered}
        />
      </div>

      <div className="flex items-center justify-between gap-4 px-4 pb-3 pt-2.5">
        <span className="data text-text-label">{formatBucket(buckets[0].start, unit, withYear)}</span>
        <span className="micro hidden sm:inline">{UNIT_NOTE[unit]}</span>
        <span className="data text-text-label">
          {formatBucket(buckets[buckets.length - 1].start, unit, withYear)}
        </span>
      </div>
    </div>
  );
}
