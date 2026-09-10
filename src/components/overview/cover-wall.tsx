"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ResilientCover } from "@/components/ui/resilient-cover";
import { EASE_OUT_EXPO } from "@/components/ui/motion";
import type { AlbumItem } from "@/modules/statistics/application/overview-service";

interface CoverWallProps {
  albums: AlbumItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

/**
 * A pilha do período. Cada capa esconde uma bolacha atrás: no hover ela
 * sai pela direita, como quem tira o disco da capa. O escolhido fica
 * com a bolacha à mostra e tinge a tela inteira com a cor dele.
 */
export function CoverWall({ albums, selectedIndex, onSelect }: CoverWallProps) {
  const reduced = useReducedMotion();
  if (!albums.length) return null;

  return (
    <div className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-3 lg:grid-cols-4">
      {albums.map((album, index) => {
        const active = index === selectedIndex;
        return (
          <motion.button
            key={`${album.id ?? album.title}-${index}`}
            type="button"
            onClick={() => onSelect(index)}
            aria-pressed={active}
            aria-label={`Tocar ${album.title}, de ${album.artistName}`}
            className="group block cursor-pointer border-0 bg-transparent p-0 text-left"
            initial={reduced ? false : { opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: index * 0.04 }}
            whileHover={reduced ? undefined : { y: -6 }}
          >
            <span className="relative block w-full">
              {/* a bolacha atrás da capa */}
              <span
                className={`absolute left-[6%] top-[3%] aspect-square h-[94%] transition-transform duration-[560ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
                  active ? "translate-x-[20%]" : "group-hover:translate-x-[20%]"
                }`}
              >
                <span
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: "radial-gradient(circle at 50% 50%, #101317 0 17%, #0a0c0f 17% 100%)",
                    boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.06), 0 14px 26px -16px rgb(0 0 0 / 0.9)",
                    animation: active && !reduced ? "gy-spin 9s linear infinite" : undefined,
                  }}
                >
                  <span
                    className="absolute inset-[8%] rounded-full"
                    style={{
                      background:
                        "repeating-radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 3px)",
                    }}
                  />
                  <span
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        "conic-gradient(from 0deg, transparent 0deg, rgb(255 255 255 / 0.06) 26deg, transparent 60deg, transparent 180deg, rgb(255 255 255 / 0.04) 210deg, transparent 248deg)",
                    }}
                  />
                  <span className="absolute left-1/2 top-1/2 h-[6%] w-[6%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
                </span>
              </span>

              <ResilientCover
                src={album.coverUrl}
                alt={`Capa de ${album.title}`}
                label={album.title}
                className={`relative aspect-square w-full rounded-[3px] transition-[box-shadow,filter] duration-500 ${
                  active
                    ? "shadow-glow ring-1 ring-accent"
                    : "ring-1 ring-white/[0.06] group-hover:ring-white/20"
                }`}
                imageClassName={
                  active
                    ? "saturate-110"
                    : "saturate-[.7] brightness-[.76] transition-[filter] duration-500 group-hover:saturate-100 group-hover:brightness-100"
                }
              />

              <span
                className="pointer-events-none absolute inset-0 rounded-[3px]"
                style={{
                  background:
                    "linear-gradient(118deg, rgb(255 255 255 / 0.08) 0%, transparent 34%, transparent 64%, rgb(255 255 255 / 0.05) 100%)",
                }}
              />

              {active && (
                <span className="data absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-background/80 px-2 py-1 text-[8.5px] uppercase tracking-[0.1em] text-accent">
                  <span
                    className="h-1 w-1 rounded-full bg-accent"
                    style={{ animation: "gy-blink 2s ease-in-out infinite" }}
                  />
                  na agulha
                </span>
              )}
            </span>

            <span className="mt-3 flex items-baseline justify-between gap-2.5">
              <span className="min-w-0 truncate text-[13px] text-text-secondary">{album.title}</span>
              <span className="data shrink-0 text-text-label">{album.plays.toLocaleString("pt-BR")}</span>
            </span>
            <span className="mt-0.5 block truncate text-xs text-text-muted">{album.artistName}</span>
          </motion.button>
        );
      })}
    </div>
  );
}
