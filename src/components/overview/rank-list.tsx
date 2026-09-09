"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE_OUT_EXPO } from "@/components/ui/motion";
import type { TopArtistItem } from "@/modules/statistics/application/overview-service";

/**
 * O ranking. A barra é a participação real do artista no período e a
 * linha ganha largura tipográfica no hover — a fonte é variável, então
 * o destaque é a própria letra crescendo, não uma caixa acendendo.
 */
export function RankList({ artists, periodKey }: { artists: TopArtistItem[]; periodKey: string }) {
  const reduced = useReducedMotion();
  if (!artists.length) return null;
  const leader = artists[0].plays || 1;

  return (
    <ul className="m-0 list-none p-0">
      <AnimatePresence mode="wait">
        <motion.div key={periodKey} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {artists.map((artist, index) => (
            <motion.li
              key={`${artist.id ?? artist.name}-${index}`}
              className="group relative isolate grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-4 border-b border-border/70 px-1 py-4 transition-[padding] duration-500 ease-out hover:pl-4"
              initial={reduced ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: index * 0.05 }}
            >
              <span className="absolute inset-y-0 left-0 z-0 w-0 bg-accent/10 transition-all duration-500 ease-out group-hover:w-full" />

              <span className="relative z-10 font-mono text-[10px] text-text-muted">{String(index + 1).padStart(2, "0")}</span>

              <span className="relative z-10 flex min-w-0 flex-col gap-2">
                <b className="rank-name truncate text-lg sm:text-xl">{artist.name}</b>
                <span className="block h-[2px] w-full bg-border">
                  <motion.span
                    className="block h-full bg-accent"
                    initial={reduced ? false : { scaleX: 0 }}
                    animate={{ scaleX: artist.plays / leader }}
                    transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: 0.1 + index * 0.05 }}
                    style={{ transformOrigin: "left center" }}
                  />
                </span>
              </span>

              <span className="relative z-10 whitespace-nowrap font-mono text-[11px] text-text-secondary tabular-nums">
                <b className="font-semibold text-text-primary">{artist.plays.toLocaleString("pt-BR")}</b>
                {" · "}
                {(artist.share * 100).toFixed(1).replace(".", ",")}%
              </span>
            </motion.li>
          ))}
        </motion.div>
      </AnimatePresence>
    </ul>
  );
}
