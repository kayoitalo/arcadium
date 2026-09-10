"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE_OUT_EXPO } from "@/components/ui/motion";
import { catalogNo } from "@/components/ui/editorial";
import type { TopArtistItem } from "@/modules/statistics/application/overview-service";

/**
 * O ranking é lido como um livro de prensagem: número de catálogo à
 * esquerda, nome, participação medida em fio de tinta e a contagem à
 * direita em mono tabular. No hover a letra ganha largura — a fonte é
 * variável, então o destaque é a própria tipografia esticando, não uma
 * caixa acendendo.
 */
const ROW = "grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 sm:gap-6";

export function RankList({ artists, periodKey }: { artists: TopArtistItem[]; periodKey: string }) {
  const reduced = useReducedMotion();
  if (!artists.length) return null;
  const leader = artists[0].plays || 1;

  return (
    <div>
      <div className={`${ROW} border-b border-border-subtle pb-2 pt-4`}>
        <span className="label">Catálogo</span>
        <span className="label">Artista · participação</span>
        <span className="label text-right">Audições</span>
      </div>

      <ul className="m-0 list-none p-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={periodKey}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {artists.map((artist, index) => (
              <motion.li
                key={`${artist.id ?? artist.name}-${index}`}
                className={`${ROW} group relative isolate border-b border-border-subtle px-1 py-4 transition-[padding] duration-500 ease-out hover:pl-3`}
                initial={reduced ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: index * 0.05 }}
              >
                <span className="absolute inset-y-0 left-0 z-0 w-0 bg-accent/[0.07] transition-all duration-500 ease-out group-hover:w-full" />

                <span className={`catalog relative z-10 ${index === 0 ? "text-accent" : ""}`}>
                  {catalogNo("A", index)}
                </span>

                <span className="relative z-10 flex min-w-0 flex-col gap-2.5">
                  <b className="rank-name truncate text-lg sm:text-xl">{artist.name}</b>
                  <span className="block h-px w-full bg-border">
                    <motion.span
                      className="block h-full bg-accent"
                      initial={reduced ? false : { scaleX: 0 }}
                      animate={{ scaleX: artist.plays / leader }}
                      transition={{ duration: 1, ease: EASE_OUT_EXPO, delay: 0.1 + index * 0.05 }}
                      style={{ transformOrigin: "left center" }}
                    />
                  </span>
                </span>

                <span className="relative z-10 whitespace-nowrap text-right">
                  <b className="numeral block text-[1.35rem] text-text-primary">
                    {artist.plays.toLocaleString("pt-BR")}
                  </b>
                  <span className="data mt-1 block text-text-muted">
                    {(artist.share * 100).toFixed(1).replace(".", ",")}%
                  </span>
                </span>
              </motion.li>
            ))}
          </motion.div>
        </AnimatePresence>
      </ul>
    </div>
  );
}
