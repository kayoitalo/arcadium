"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ScreenLine } from "@/components/ui/screen-line";
import { formatGenre } from "@/lib/format/genre";
import { useScreenChrome } from "@/components/layout/chrome";
import { EASE_OUT_EXPO, InViewFade } from "@/components/ui/motion";
import type { OverviewData, PeriodKey, TasteShiftItem } from "@/modules/statistics/application/overview-service";

const PERIODS = [
  { key: "30d", label: "30 dias" },
  { key: "1y", label: "1 ano" },
];

const decimal = (value: number) => value.toString().replace(".", ",");

/**
 * Uma linha por gênero: bolinha vazada onde ele estava, bolinha cheia
 * onde chegou. O que interessa é a distância entre as duas — o número
 * à direita é só confirmação.
 */
function ShiftRow({
  item,
  scale,
  rising,
  index,
}: {
  item: TasteShiftItem;
  scale: number;
  rising: boolean;
  index: number;
}) {
  const from = Math.min(100, (item.previousShare / scale) * 100);
  const to = Math.min(100, (item.currentShare / scale) * 100);
  const left = Math.min(from, to);
  const width = Math.abs(to - from);
  const color = rising ? "var(--chroma)" : "#d1665a";
  const delta = Number((item.currentShare - item.previousShare).toFixed(1));

  return (
    <motion.li
      className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-4 border-b border-border/55 px-1.5 py-4 transition-colors duration-300 hover:bg-surface-elevated/70 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_140px] sm:gap-6"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: index * 0.05 }}
    >
      <span className="truncate text-[15px] text-text-primary">{formatGenre(item.genre)}</span>

      <span className="relative block h-[18px]">
        <span
          className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2"
          style={{ background: "repeating-linear-gradient(90deg, #1b2129 0 3px, transparent 3px 7px)" }}
        />
        <motion.span
          className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-sm"
          style={{
            left: `${left}%`,
            background: rising
              ? "linear-gradient(90deg, var(--chroma-deep), var(--chroma))"
              : "linear-gradient(90deg, #d1665a, rgb(209 102 90 / 0.35))",
          }}
          initial={{ width: 0 }}
          whileInView={{ width: `${width}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: EASE_OUT_EXPO, delay: 0.15 + index * 0.05 }}
        />
        <span
          title={`antes: ${decimal(item.previousShare)}%`}
          className="absolute top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-text-label bg-background"
          style={{ left: `${from}%` }}
        />
        <motion.span
          title={`agora: ${decimal(item.currentShare)}%`}
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            left: `${to}%`,
            background: color,
            boxShadow: rising ? "0 0 14px -2px var(--chroma-glow)" : undefined,
          }}
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: 0.6 + index * 0.05 }}
        />
      </span>

      <span className="data flex items-center justify-end gap-2 whitespace-nowrap text-text-muted">
        {decimal(item.previousShare)}% <span className="text-border">→</span>
        <b style={{ color }}>{decimal(item.currentShare)}%</b>
        <span
          className="rounded-full px-2 py-0.5"
          style={{ color, background: rising ? "var(--chroma-soft)" : "rgb(209 102 90 / 0.12)" }}
        >
          {delta > 0 ? "+" : "−"}
          {decimal(Math.abs(delta))}pp
        </span>
      </span>
    </motion.li>
  );
}

export default function TasteEvolutionPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useScreenChrome({
    title: "Evolução",
    periods: PERIODS,
    period,
    onPeriod: (key) => setPeriod(key as PeriodKey),
  });

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/overview?period=${period}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Não foi possível comparar os períodos.");
        return response.json();
      })
      .then(setData)
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") setError(cause.message);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [period]);

  const rising = data?.tasteShift.rising ?? [];
  const declining = data?.tasteShift.declining ?? [];
  const hasShift = rising.length > 0 || declining.length > 0;

  // uma escala só para os dois lados, senão as distâncias mentem
  const scale = useMemo(() => {
    const shares = [...rising, ...declining].flatMap((item) => [item.previousShare, item.currentShare]);
    return Math.max(1, ...shares);
  }, [rising, declining]);

  const biggest = rising[0];

  const stats = [
    {
      label: "Maior salto",
      value: biggest ? formatGenre(biggest.genre) : "—",
      note: biggest
        ? `${decimal(biggest.previousShare)}% → ${decimal(biggest.currentShare)}%`
        : "sem dado no período",
      color: "var(--chroma)",
    },
    {
      label: "Em alta",
      value: String(rising.length),
      note: rising.length === 1 ? "gênero ganhou espaço" : "gêneros ganharam espaço",
      color: "#f2f4f3",
    },
    {
      label: "Em queda",
      value: String(declining.length),
      note: declining.length === 1 ? "gênero perdeu espaço" : "gêneros perderam espaço",
      color: "#d1665a",
    },
  ];

  return (
    <div className="gy-page flex flex-col gap-16">
      <header className="grid items-end gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div>
          <div className="flex items-center gap-3">
            <span className="h-px w-[34px] bg-accent" />
            <span className="eyebrow text-accent">Contra o período anterior</span>
          </div>
          <h1 className="display mt-5 max-w-[14ch] text-[clamp(2.6rem,5.6vw,4.6rem)]">
            <span className="block overflow-hidden">
              <span className="gy-rise">O que mudou</span>
            </span>
          </h1>
          <div className="max-w-[52ch]">
            <ScreenLine
              screen="evolution"
              fallback="Cada gênero saiu de um ponto e chegou a outro. A distância entre as duas bolinhas é a história."
            />
          </div>
        </div>

        {hasShift && (
          <div className="ruled grid-cols-3 border border-border">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-background-secondary px-4 py-5">
                <span className="eyebrow">{stat.label}</span>
                <strong
                  className="numeral mt-2.5 block truncate text-[26px]"
                  style={{ color: stat.color }}
                >
                  {stat.value}
                </strong>
                <span className="data mt-2 block text-text-muted">{stat.note}</span>
              </div>
            ))}
          </div>
        )}
      </header>

      {loading && <p className="eyebrow">Comparando os dois períodos…</p>}

      {error && (
        <div className="panel p-6">
          <span className="eyebrow text-status-error">Falha de leitura</span>
          <p className="mt-2 text-sm text-status-error">{error}</p>
        </div>
      )}

      {!loading && !error && !hasShift && (
        <section className="py-16">
          <h2 className="headline max-w-[18ch] text-[clamp(1.6rem,3vw,2.4rem)]">
            Ainda não dá para comparar.
          </h2>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-[1.66] text-text-secondary">
            Para medir o movimento é preciso conhecer o gênero dos artistas nos dois períodos — e isso
            vai sendo preenchido aos poucos, em segundo plano.
          </p>
        </section>
      )}

      {!loading && !error && hasShift && (
        <>
          {rising.length > 0 && (
            <InViewFade>
              <section>
                <div className="flex items-baseline justify-between gap-6 border-b border-border pb-3.5">
                  <h2 className="headline text-[clamp(1.4rem,2.6vw,1.9rem)]">Ganhou espaço</h2>
                  <div className="micro flex gap-8">
                    <span>0%</span>
                    <span>{decimal(Number((scale / 2).toFixed(1)))}%</span>
                    <span>{decimal(Number(scale.toFixed(1)))}%</span>
                  </div>
                </div>
                <ul className="m-0 list-none p-0">
                  {rising.map((item, index) => (
                    <ShiftRow key={item.genre} item={item} scale={scale} rising index={index} />
                  ))}
                </ul>
              </section>
            </InViewFade>
          )}

          {declining.length > 0 && (
            <InViewFade>
              <section>
                <div className="flex items-baseline justify-between gap-6 border-b border-border pb-3.5">
                  <h2 className="headline text-[clamp(1.4rem,2.6vw,1.9rem)]">Perdeu espaço</h2>
                  <span className="micro">mesma escala</span>
                </div>
                <ul className="m-0 list-none p-0">
                  {declining.map((item, index) => (
                    <ShiftRow key={item.genre} item={item} scale={scale} rising={false} index={index} />
                  ))}
                </ul>
              </section>
            </InViewFade>
          )}
        </>
      )}
    </div>
  );
}
