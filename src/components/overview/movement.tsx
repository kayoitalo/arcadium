"use client";

import { motion } from "framer-motion";
import { ResilientCover } from "@/components/ui/resilient-cover";
import { SectionHead } from "@/components/ui/section-head";
import { formatGenre } from "@/lib/format/genre";
import { EASE_OUT_EXPO } from "@/components/ui/motion";
import type { DiscoveryItem, TasteShiftItem } from "@/modules/statistics/application/overview-service";

const decimal = (value: number) => value.toString().replace(".", ",");

const DAY_MONTH = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });

function when(iso: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return DAY_MONTH.format(date);
}

/**
 * Duas leituras lado a lado do mesmo período: o que mudou de tamanho
 * (gênero por gênero, a partir do meio) e o que entrou pela primeira
 * vez. A barra sai do centro porque o que interessa é a direção e a
 * distância, não o valor absoluto.
 */
export function Movement({
  rising,
  declining,
  discoveries,
}: {
  rising: TasteShiftItem[];
  declining: TasteShiftItem[];
  discoveries: DiscoveryItem[];
}) {
  const items = [
    ...rising.slice(0, 5).map((item) => ({ item, up: true })),
    ...declining.slice(0, 4).map((item) => ({ item, up: false })),
  ];
  const debuts = discoveries.slice(0, 5);

  const scale = Math.max(
    1,
    ...items.map(({ item }) => Math.abs(item.currentShare - item.previousShare)),
  );

  return (
    <section className="ruled border border-border md:grid-cols-[1.25fr_1fr]">
      <div className="bg-background p-6 sm:p-7">
        <SectionHead index="03" eyebrow="Movimento de gosto" title="O que subiu, o que caiu" />

        {items.length === 0 ? (
          <p className="data mt-6 text-text-muted">Nenhum gênero mudou de tamanho neste período.</p>
        ) : (
          <ul className="m-0 mt-3 list-none p-0">
            {items.map(({ item, up }, index) => {
              const delta = item.currentShare - item.previousShare;
              const width = (Math.abs(delta) / scale) * 50;
              const color = up ? "var(--machine)" : "var(--color-status-error)";

              return (
                <motion.li
                  key={`${item.genre}-${up ? "up" : "down"}`}
                  className="grid grid-cols-[minmax(0,1fr)_96px_62px] items-center gap-4 border-b border-rule py-2.5"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: index * 0.03 }}
                >
                  <span className="truncate text-sm text-text-primary">{formatGenre(item.genre)}</span>

                  <span className="relative block h-3">
                    <span className="absolute inset-y-0 left-1/2 w-px bg-border-strong" />
                    <motion.span
                      className="absolute top-1/2 h-[6px] -translate-y-1/2"
                      style={{ background: color, left: up ? "50%" : `${50 - width}%` }}
                      initial={{ width: 0 }}
                      whileInView={{ width: `${width}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: 0.1 + index * 0.03 }}
                    />
                  </span>

                  <span className="data text-right" style={{ color }}>
                    {delta > 0 ? "▲" : "▼"} {decimal(Number(Math.abs(delta).toFixed(1)))}pp
                  </span>
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="bg-background p-6 sm:p-7">
        <SectionHead
          eyebrow="Entrou agora"
          title={debuts.length === 0 ? "Nenhuma estreia" : debuts.length === 1 ? "Uma estreia" : `${debuts.length} estreias`}
        />

        {debuts.length === 0 ? (
          <p className="data mt-6 text-text-muted">Nenhum artista novo neste período.</p>
        ) : (
          <ul className="m-0 mt-3 list-none p-0">
            {debuts.map((entry, index) => (
              <motion.li
                key={entry.id}
                className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3.5 border-b border-rule py-2.5"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: index * 0.04 }}
              >
                <ResilientCover
                  src={entry.coverUrl}
                  alt=""
                  label={entry.albumName}
                  compact
                  className="h-11 w-11"
                />

                <span className="flex min-w-0 flex-col gap-0.5">
                  <b className="truncate text-sm font-semibold text-text-primary">{entry.artistName}</b>
                  <span className="truncate text-xs text-text-muted">{entry.albumName}</span>
                </span>

                <span className="data text-text-muted">{when(entry.discoveredAt)}</span>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
