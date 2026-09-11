"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Meter } from "@/components/ui/console";
import { EASE_OUT_EXPO } from "@/components/ui/motion";
import { formatGenre } from "@/lib/format/genre";
import type { TopArtistItem } from "@/modules/statistics/application/overview-service";

/**
 * O ranking como tabela de console: posição, nome, medidor de
 * participação, percentual e audições. O medidor mede contra o líder,
 * então a primeira linha sempre enche; o percentual é o real.
 *
 * A segunda linha só mostra o que a catalogação já resolveu: gênero e
 * país aparecem quando existem, e somem quando não.
 */
const ROW =
  "grid grid-cols-[30px_minmax(0,1fr)_64px] items-center gap-4 md:grid-cols-[34px_minmax(0,1.15fr)_minmax(0,1fr)_56px_72px] md:gap-5";

export function RankList({ artists, periodKey }: { artists: TopArtistItem[]; periodKey: string }) {
  const reduced = useReducedMotion();
  if (!artists.length) return null;
  const leader = artists[0].plays || 1;

  return (
    <div>
      <div className={`${ROW} border-b border-border px-2 py-2.5`}>
        <span className="micro">#</span>
        <span className="micro">artista</span>
        <span className="micro hidden md:block">participação</span>
        <span className="micro hidden text-right md:block">%</span>
        <span className="micro text-right">audições</span>
      </div>

      <AnimatePresence mode="wait">
        <motion.ol
          key={periodKey}
          className="m-0 list-none p-0"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {artists.map((artist, index) => {
            const genre = artist.tags?.[0];
            const detail = [genre && formatGenre(genre), artist.country].filter(Boolean).join(" · ");
            const share = `${(artist.share * 100).toFixed(1).replace(".", ",")}%`;

            return (
              <motion.li
                key={`${artist.id ?? artist.name}-${index}`}
                className={`${ROW} group border-b border-rule px-2 py-3.5 transition-colors duration-150 hover:bg-surface`}
                initial={reduced ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: EASE_OUT_EXPO, delay: index * 0.03 }}
              >
                <span className={`numeral text-[15px] ${index === 0 ? "text-accent" : "text-text-muted"}`}>
                  {String(index + 1).padStart(2, "0")}
                </span>

                <span className="flex min-w-0 flex-col gap-1">
                  <b className="rank-name truncate text-lg sm:text-xl">{artist.name}</b>
                  {detail && <span className="data truncate text-text-muted">{detail}</span>}
                </span>

                <Meter
                  ratio={artist.plays / leader}
                  label={`${artist.name}: ${share} da escuta`}
                  segments={24}
                  className="hidden md:grid"
                />

                <span className="data hidden text-right text-text-secondary md:block">{share}</span>

                <span className="data whitespace-nowrap text-right text-[13px] font-semibold text-text-primary">
                  {artist.plays.toLocaleString("pt-BR")}
                </span>
              </motion.li>
            );
          })}
        </motion.ol>
      </AnimatePresence>
    </div>
  );
}
