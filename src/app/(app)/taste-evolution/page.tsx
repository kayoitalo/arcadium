"use client";

import { useEffect, useMemo, useState } from "react";
import { ScreenLine } from "@/components/ui/screen-line";
import { motion } from "framer-motion";
import type { OverviewData, PeriodKey, TasteShiftItem } from "@/modules/statistics/application/overview-service";
import { EASE_OUT_EXPO, InViewFade, Reveal } from "@/components/ui/motion";
import { SectionHead } from "@/components/ui/editorial";

const PERIODS = [
  { key: "30d" as const, label: "30 dias" },
  { key: "1y" as const, label: "1 ano" },
];

const decimal = (value: number) => value.toString().replace(".", ",");

/**
 * Uma linha por gênero: bolinha vazada onde ele estava, bolinha cheia
 * onde chegou. O que interessa é a distância entre as duas — por isso o
 * movimento absoluto vem primeiro e o percentual fica de legenda.
 */
function ShiftRow({ item, scale, direction, index }: { item: TasteShiftItem; scale: number; direction: "up" | "down"; index: number }) {
  const from = Math.min(100, (item.previousShare / scale) * 100);
  const to = Math.min(100, (item.currentShare / scale) * 100);
  const left = Math.min(from, to);
  const width = Math.abs(to - from);
  const rising = direction === "up";

  return (
    <motion.li
      className="group grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_auto] items-center gap-4 border-b border-border-subtle py-4 sm:gap-6"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: index * 0.05 }}
    >
      <span className="section-title truncate text-[0.8125rem] text-text-primary">{item.genre}</span>

      <span className="relative block h-4">
        <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
        <motion.span
          className={`absolute top-1/2 h-[2px] -translate-y-1/2 ${rising ? "bg-accent" : "bg-status-error/70"}`}
          style={{ left: `${left}%` }}
          initial={{ width: 0 }}
          whileInView={{ width: `${width}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: EASE_OUT_EXPO, delay: 0.15 + index * 0.05 }}
        />
        <span
          className="absolute top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 border border-text-muted bg-background"
          style={{ left: `${from}%` }}
          title={`antes: ${decimal(item.previousShare)}%`}
        />
        <motion.span
          className={`absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 ${rising ? "bg-accent" : "bg-status-error"}`}
          style={{ left: `${to}%` }}
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: 0.6 + index * 0.05 }}
          title={`agora: ${decimal(item.currentShare)}%`}
        />
      </span>

      <span className="data whitespace-nowrap text-text-muted">
        {decimal(item.previousShare)}%
        <span className="mx-1.5 text-border">→</span>
        <b className={rising ? "text-accent" : "text-status-error"}>{decimal(item.currentShare)}%</b>
      </span>
    </motion.li>
  );
}

export default function TasteEvolutionPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-14">
      <header className="flex flex-col justify-between gap-8 border-b border-border pb-9 sm:flex-row sm:items-end">
        <div>
          <div className="flex items-center gap-3">
            <span className="catalog text-accent">GY/02</span>
            <span className="label">Contra o período anterior</span>
          </div>
          <h1 className="headline mt-4 max-w-[12ch] text-[clamp(2.2rem,5.4vw,3.9rem)]">
            <Reveal>O que mudou</Reveal>
          </h1>
          <div className="max-w-[52ch]">
            <ScreenLine screen="evolution" fallback="O que entrou e o que saiu de moda no seu fone." />
          </div>
        </div>

        <div className="flex divide-x divide-border self-start border border-border sm:self-end">
          {PERIODS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setPeriod(option.key)}
              data-active={period === option.key}
              aria-pressed={period === option.key}
              className="tab"
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      {loading && <p className="label">Comparando as duas gavetas…</p>}

      {error && (
        <div className="border border-status-error/40 bg-status-error/[0.07] p-6">
          <span className="label text-status-error">Falha de leitura</span>
          <p className="mt-2 text-sm text-status-error">{error}</p>
        </div>
      )}

      {!loading && !error && !hasShift && (
        <section className="py-14">
          <h2 className="headline max-w-[18ch] text-[clamp(1.6rem,3vw,2.4rem)]">Ainda não dá para comparar.</h2>
          <p className="liner mt-5 max-w-[46ch]">
            Para medir o movimento é preciso conhecer o gênero dos artistas nos dois períodos — e a
            catalogação vai sendo preenchida aos poucos, em segundo plano.
          </p>
        </section>
      )}

      {!loading && !error && hasShift && (
        <>
          {biggest && (
            <p className="liner-lead max-w-[52ch] border-l border-accent pl-5">
              <em className="capitalize">{biggest.genre}</em> foi o maior salto: saiu de{" "}
              {decimal(biggest.previousShare)}% para {decimal(biggest.currentShare)}% da sua escuta.
            </p>
          )}

          {rising.length > 0 && (
            <InViewFade>
              <section>
                <SectionHead code="GY/02·A" title="Ganhou espaço" note="antes → agora" />
                <ul className="m-0 list-none p-0">
                  {rising.map((item, index) => (
                    <ShiftRow key={item.genre} item={item} scale={scale} direction="up" index={index} />
                  ))}
                </ul>
              </section>
            </InViewFade>
          )}

          {declining.length > 0 && (
            <InViewFade>
              <section>
                <SectionHead code="GY/02·B" title="Perdeu espaço" note="antes → agora" />
                <ul className="m-0 list-none p-0">
                  {declining.map((item, index) => (
                    <ShiftRow key={item.genre} item={item} scale={scale} direction="down" index={index} />
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
