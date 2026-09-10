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

  const scale = Math.max(
    1,
    ...items.map(({ item }) => Math.abs(item.currentShare - item.previousShare)),
  );

  return (
    <section className="ruled border border-border md:grid-cols-[1.25fr_1fr]">
      <div className="bg-background-secondary p-6 sm:p-8">
        <SectionHead index="03" eyebrow="Movimento de gosto" />
        <h2 className="headline mt-3 text-[clamp(1.4rem,2.4vw,1.85rem)]">O que subiu, o que caiu</h2>

        <ul className="m-0 mt-7 list-none p-0">
          {items.map(({ item, up }, index) => {
            const delta = item.currentShare - item.previousShare;
            const width = (Math.abs(delta) / scale) * 50;
            const color = up ? "var(--chroma)" : "#d1665a";

            return (
              <motion.li
                key={`${item.genre}-${up ? "up" : "down"}`}
                className="grid grid-cols-[minmax(0,1fr)_78px_62px] items-center gap-3.5 border-b border-rule/80 py-2.5"
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, ease: EASE_OUT_EXPO, delay: index * 0.04 }}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="h-3.5 w-[3px] shrink-0" style={{ background: color }} />
                  <span className="truncate text-sm text-text-primary">{formatGenre(item.genre)}</span>
                </span>

                <span className="relative block h-3.5">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
                  <motion.span
                    className="absolute top-1/2 h-1 -translate-y-1/2 rounded-sm"
                    style={{
                      background: color,
                      left: up ? "50%" : `${50 - width}%`,
                      transformOrigin: up ? "left center" : "right center",
                    }}
                    initial={{ width: 0 }}
                    whileInView={{ width: `${width}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.9, ease: EASE_OUT_EXPO, delay: 0.1 + index * 0.04 }}
                  />
                </span>

                <span className="data text-right" style={{ color }}>
                  {delta > 0 ? "+" : "−"}
                  {decimal(Number(Math.abs(delta).toFixed(1)))}pp
                </span>
              </motion.li>
            );
          })}
        </ul>
      </div>

      <div className="bg-background-secondary p-6 sm:p-8">
        <span className="eyebrow">Entrou agora</span>
        <h3 className="headline mt-3 text-[clamp(1.4rem,2.4vw,1.85rem)]">
          {discoveries.length === 1 ? "Uma estreia" : `${discoveries.slice(0, 5).length} estreias`}
        </h3>

        <ul className="m-0 mt-7 flex list-none flex-col gap-3.5 p-0">
          {discoveries.slice(0, 5).map((entry, index) => (
            <motion.li
              key={entry.id}
              className="grid grid-cols-[54px_minmax(0,1fr)_auto] items-center gap-3"
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, ease: EASE_OUT_EXPO, delay: index * 0.05 }}
            >
              <span className="relative block h-[42px] w-[54px]">
                <span
                  className="absolute left-3.5 top-px h-10 w-10 rounded-full"
                  style={{
                    background: "radial-gradient(circle at 50% 50%, #101317 0 18%, #0b0d10 18% 100%)",
                    boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.06)",
                  }}
                >
                  <span
                    className="absolute inset-[11%] rounded-full"
                    style={{
                      background:
                        "repeating-radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.055) 0 1px, transparent 1px 3px)",
                    }}
                  />
                </span>
                <ResilientCover
                  src={entry.coverUrl}
                  alt=""
                  label={entry.albumName}
                  compact
                  className="absolute left-0 top-0 h-[42px] w-[42px] rounded-sm shadow-[0_2px_8px_rgb(0_0_0/0.5)]"
                />
              </span>

              <span className="flex min-w-0 flex-col gap-0.5">
                <b className="truncate text-sm font-semibold text-text-primary">{entry.artistName}</b>
                <span className="truncate text-xs text-text-muted">{entry.albumName}</span>
              </span>

              <span className="data text-text-muted">{when(entry.discoveredAt)}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}
