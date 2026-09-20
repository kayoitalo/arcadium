"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ScreenLine } from "@/components/ui/screen-line";
import { formatGenre } from "@/lib/format/genre";
import { shiftColor, shiftMark, shiftTone } from "@/lib/format/shift";
import { useScreenChrome } from "@/components/layout/chrome";
import { Readout } from "@/components/ui/console";
import { EASE_OUT_EXPO, InViewFade } from "@/components/ui/motion";
import type { OverviewData, PeriodKey, TasteShiftItem } from "@/modules/statistics/application/overview-service";

const PERIODS = [
  { key: "30d", label: "30 dias" },
  { key: "1y", label: "1 ano" },
];

const decimal = (value: number) => value.toString().replace(".", ",");

/**
 * Uma linha por gênero: quadrado vazado onde ele estava, quadrado aceso
 * onde chegou. O que interessa é a distância entre os dois — o número
 * à direita é só confirmação.
 */
function ShiftRow({
  item,
  scale,
  index,
}: {
  item: TasteShiftItem;
  scale: number;
  index: number;
}) {
  const from = Math.min(100, (item.previousShare / scale) * 100);
  const to = Math.min(100, (item.currentShare / scale) * 100);
  const left = Math.min(from, to);
  const width = Math.abs(to - from);
  const delta = Number((item.currentShare - item.previousShare).toFixed(1));
  const tone = shiftTone(delta);
  const color = shiftColor(tone);

  return (
    <motion.li
      className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-4 border-b border-rule px-2 py-3.5 transition-colors duration-150 hover:bg-surface sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_150px] sm:gap-6"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
    >
      <span className="truncate text-[15px] text-text-primary">{formatGenre(item.genre)}</span>

      <span className="relative block h-[18px]">
        <span
          className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2"
          style={{ background: "repeating-linear-gradient(90deg, #1b2129 0 3px, transparent 3px 7px)" }}
        />
        <motion.span
          className="absolute top-1/2 h-[3px] -translate-y-1/2"
          style={{ left: `${left}%`, background: color, opacity: 0.7 }}
          initial={{ width: 0 }}
          whileInView={{ width: `${width}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.1 + index * 0.03 }}
        />
        <span
          title={`antes: ${decimal(item.previousShare)}%`}
          className="absolute top-1/2 h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 border border-text-label bg-background"
          style={{ left: `${from}%` }}
        />
        <motion.span
          title={`agora: ${decimal(item.currentShare)}%`}
          className="absolute top-1/2 h-[11px] w-[11px] -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${to}%`,
            background: color,
            // o halo marca o lado que cresceu, e só ele
            boxShadow: tone === "up" ? "0 0 8px rgb(57 135 229 / 0.55)" : undefined,
          }}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.05, delay: 0.5 + index * 0.03 }}
        />
      </span>

      <span className="data flex items-center justify-end gap-2 whitespace-nowrap text-text-muted">
        {decimal(item.previousShare)}% <span className="text-border-strong">→</span>
        <b style={{ color }}>{decimal(item.currentShare)}%</b>
        <span className="border px-1.5 py-0.5" style={{ color, borderColor: "currentColor" }}>
          {shiftMark(tone)} {decimal(Math.abs(delta))}pp
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
      note: biggest ? `${decimal(biggest.previousShare)}% → ${decimal(biggest.currentShare)}%` : "sem dado no período",
      tone: "up" as const,
    },
    {
      label: "Em alta",
      value: String(rising.length),
      note: rising.length === 1 ? "gênero ganhou espaço" : "gêneros ganharam espaço",
      tone: "up" as const,
    },
    {
      label: "Em queda",
      value: String(declining.length),
      note: declining.length === 1 ? "gênero perdeu espaço" : "gêneros perderam espaço",
      tone: "down" as const,
    },
  ];

  return (
    <div className="gy-page flex flex-col gap-14">
      <header className="grid items-end gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
        <div>
          <span className="eyebrow">Contra o período anterior</span>
          <h1 className="display mt-4 max-w-[14ch] text-[clamp(2.6rem,5.6vw,4.6rem)]">
            <span className="block overflow-hidden">
              <span className="gy-rise">O que mudou</span>
            </span>
          </h1>
          <div className="max-w-[56ch]">
            <ScreenLine
              screen="evolution"
              label="evolução"
              period={period}
              fallback="Cada gênero saiu de um ponto e chegou a outro. A distância entre os dois quadrados é a história."
            />
          </div>
        </div>

        {hasShift && (
          <div className="ruled grid-cols-3 border border-border">
            {stats.map((stat) => (
              <Readout
                key={stat.label}
                label={stat.label}
                className="px-4 py-5"
                footer={<span className="data text-text-muted">{stat.note}</span>}
              >
                <strong className="numeral block truncate text-[26px]" style={{ color: shiftColor(stat.tone) }}>
                  {stat.value}
                </strong>
              </Readout>
            ))}
          </div>
        )}
      </header>

      {loading && (
        <p className="data flex items-center gap-2 text-text-muted">
          <span className="led" data-on="true" style={{ animation: "gy-blink 0.7s steps(1) infinite" }} />
          comparando os dois períodos
        </p>
      )}

      {error && (
        <div className="border border-status-error/50 bg-well p-5">
          <span className="eyebrow text-status-error">Falha de leitura</span>
          <p className="mt-2 text-sm text-status-error">{error}</p>
        </div>
      )}

      {!loading && !error && !hasShift && (
        <section className="border border-border bg-well p-6">
          <h2 className="headline max-w-[18ch] text-[clamp(1.6rem,3vw,2.4rem)]">Ainda não dá para comparar.</h2>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-[1.66] text-text-secondary">
            Para medir o movimento é preciso conhecer o gênero dos artistas nos dois períodos — e isso vai
            sendo preenchido aos poucos, em segundo plano.
          </p>
        </section>
      )}

      {!loading && !error && hasShift && (
        <>
          {rising.length > 0 && (
            <InViewFade>
              <section>
                <div className="flex items-end justify-between gap-6 border-b border-border pb-3.5">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="eyebrow text-accent">01</span>
                      <span className="h-px w-3 bg-border-strong" />
                      <span className="eyebrow">em alta</span>
                    </div>
                    <h2 className="headline mt-3 text-[clamp(1.4rem,2.6vw,1.9rem)]">Ganhou espaço</h2>
                  </div>
                  <div className="micro flex gap-8">
                    <span>0%</span>
                    <span>{decimal(Number((scale / 2).toFixed(1)))}%</span>
                    <span>{decimal(Number(scale.toFixed(1)))}%</span>
                  </div>
                </div>
                <ul className="m-0 list-none p-0">
                  {rising.map((item, index) => (
                    <ShiftRow key={item.genre} item={item} scale={scale} index={index} />
                  ))}
                </ul>
              </section>
            </InViewFade>
          )}

          {declining.length > 0 && (
            <InViewFade>
              <section>
                <div className="flex items-end justify-between gap-6 border-b border-border pb-3.5">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="eyebrow text-accent">02</span>
                      <span className="h-px w-3 bg-border-strong" />
                      <span className="eyebrow">em queda</span>
                    </div>
                    <h2 className="headline mt-3 text-[clamp(1.4rem,2.6vw,1.9rem)]">Perdeu espaço</h2>
                  </div>
                  <span className="micro">mesma escala</span>
                </div>
                <ul className="m-0 list-none p-0">
                  {declining.map((item, index) => (
                    <ShiftRow key={item.genre} item={item} scale={scale} index={index} />
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
