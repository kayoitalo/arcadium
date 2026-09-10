"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { EASE_OUT_EXPO } from "@/components/ui/motion";
import { formatGenre } from "@/lib/format/genre";
import type { TopArtistItem } from "@/modules/statistics/application/overview-service";

/**
 * O ranking. A barra é a participação real do artista no período e a
 * linha ganha largura tipográfica no hover — a fonte é variável, então
 * o destaque é a própria letra crescendo, não uma caixa acendendo.
 *
 * A segunda linha só mostra o que a catalogação já resolveu: gênero e
 * país aparecem quando existem, e somem quando não.
 */
const ROW = "grid grid-cols-[30px_minmax(0,1fr)_auto] items-center gap-4 sm:gap-5";

export function RankList({ artists, periodKey }: { artists: TopArtistItem[]; periodKey: string }) {
  const reduced = useReducedMotion();
  if (!artists.length) return null;
  const leader = artists[0].plays || 1;

  return (
    <div>
      <div className={`${ROW} border-b border-border/50 px-1.5 py-3`}>
        <span className="micro">#</span>
        <span className="micro">artista · participação</span>
        <span className="micro text-right">audições</span>
      </div>

      <ul className="m-0 list-none p-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={periodKey}
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {artists.map((artist, index) => {
              const genre = artist.tags?.[0];
              return (
                <motion.li
                  key={`${artist.id ?? artist.name}-${index}`}
                  className={`${ROW} group border-b border-border/55 px-1.5 py-4 transition-[padding,background] duration-500 ease-out hover:bg-surface-elevated/70 hover:pl-4`}
                  initial={reduced ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay: index * 0.05 }}
                >
                  <span
                    className="numeral text-[15px]"
                    style={{ color: index === 0 ? "var(--chroma)" : "#79838c" }}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <span className="flex min-w-0 flex-col gap-2">
                    <b className="rank-name truncate text-lg sm:text-xl">{artist.name}</b>
                    <span className="flex items-center gap-2.5">
                      <span className="block h-[2px] max-w-[320px] flex-1 bg-rule">
                        <motion.span
                          className="block h-full"
                          style={{
                            transformOrigin: "left center",
                            background: "linear-gradient(90deg, var(--chroma-deep), var(--chroma))",
                          }}
                          initial={reduced ? false : { scaleX: 0 }}
                          animate={{ scaleX: artist.plays / leader }}
                          transition={{ duration: 1.1, ease: EASE_OUT_EXPO, delay: 0.1 + index * 0.05 }}
                        />
                      </span>
                      <span className="data shrink-0 text-text-muted">
                        {(artist.share * 100).toFixed(1).replace(".", ",")}%
                        {genre && <span className="text-text-label"> · {formatGenre(genre)}</span>}
                        {artist.country && <span className="text-text-label"> · {artist.country}</span>}
                      </span>
                    </span>
                  </span>

                  <span className="data whitespace-nowrap text-right text-[13px] font-semibold text-text-primary">
                    {artist.plays.toLocaleString("pt-BR")}
                  </span>
                </motion.li>
              );
            })}
          </motion.div>
        </AnimatePresence>
      </ul>
    </div>
  );
}
