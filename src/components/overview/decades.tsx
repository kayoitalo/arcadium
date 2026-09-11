"use client";

import { motion, useReducedMotion } from "framer-motion";
import { EASE_OUT_EXPO } from "@/components/ui/motion";
import type { DecadeDistribution } from "@/modules/statistics/application/decades";

const decimal = (value: number) => value.toString().replace(".", ",");

/**
 * De que época vêm os discos do período. O ano de lançamento vem do
 * catálogo da Apple (ou do MusicBrainz, quando ele conhece o disco), e
 * nem todo disco tem: a cobertura fica escrita ao lado em vez de sumir
 * dentro das barras — sem ela, 40% da coleção passaria por retrato
 * inteiro.
 */
export function Decades({ distribution }: { distribution: DecadeDistribution }) {
  const reduced = useReducedMotion();
  const { items, coverage } = distribution;
  if (items.length === 0) return null;

  const max = Math.max(...items.map((item) => item.plays));
  const top = items.reduce((a, b) => (b.plays > a.plays ? b : a));

  return (
    <div className="border border-border bg-well">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-rule px-4 py-2.5">
        <span className="data text-text-secondary">
          <span className="text-text-muted">mais tocada · </span>
          anos {String(top.decade).slice(2)}
        </span>
        <span className="data">
          <b className="text-[13px] font-semibold text-text-primary">{decimal(top.share)}%</b>
          <span className="text-text-muted"> das audições datadas</span>
        </span>
      </div>

      <ul
        className="m-0 grid list-none gap-3 p-4"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map((item, index) => (
          <li key={item.decade} className="flex flex-col gap-2">
            <span className="spectrum-col relative h-[120px]">
              <motion.span
                className="spectrum-lit absolute inset-x-0 bottom-0"
                data-hot={item.decade === top.decade}
                initial={reduced ? false : { height: 0 }}
                whileInView={{ height: `${Math.max(4, (item.plays / max) * 100)}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: index * 0.05 }}
              />
            </span>
            <span className="data text-center text-text-secondary">{String(item.decade).slice(2)}</span>
            <span className="data text-center text-text-muted">{decimal(item.share)}%</span>
          </li>
        ))}
      </ul>

      <p className="data border-t border-rule px-4 py-2.5 text-text-muted">
        {coverage}% das audições do período têm ano de lançamento conhecido
        {coverage < 70 && " — o catálogo ainda está preenchendo o resto"}
      </p>
    </div>
  );
}
