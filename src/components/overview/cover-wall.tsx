"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ResilientCover } from "@/components/ui/resilient-cover";
import { EASE_OUT_EXPO } from "@/components/ui/motion";
import { catalogNo } from "@/components/ui/editorial";
import type { AlbumItem } from "@/modules/statistics/application/overview-service";

interface CoverWallProps {
  albums: AlbumItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

/**
 * A prateleira: capa quadrada com legenda embaixo, como prancha de
 * catálogo. Escolher um disco tinge a ficha inteira com a cor dele.
 */
export function CoverWall({ albums, selectedIndex, onSelect }: CoverWallProps) {
  const reduced = useReducedMotion();
  if (!albums.length) return null;

  return (
    <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-4 pt-6">
      {albums.map((album, index) => {
        const active = index === selectedIndex;
        return (
          <motion.button
            key={`${album.id ?? album.title}-${index}`}
            type="button"
            onClick={() => onSelect(index)}
            aria-pressed={active}
            aria-label={`Focar em ${album.title}, de ${album.artistName}`}
            className="group w-[136px] shrink-0 snap-start text-left sm:w-[154px]"
            initial={reduced ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: index * 0.05 }}
            whileHover={reduced ? undefined : { y: -6 }}
            whileTap={{ scale: 0.99 }}
          >
            <ResilientCover
              src={album.coverUrl}
              alt={`Capa de ${album.title}`}
              label={album.title}
              className={`aspect-square w-full border transition-colors duration-500 ${
                active ? "border-accent shadow-glow" : "border-border group-hover:border-text-muted"
              }`}
              imageClassName={`transition-[filter] duration-500 ${
                active
                  ? "saturate-105"
                  : "saturate-[.6] brightness-[.7] group-hover:saturate-100 group-hover:brightness-100"
              }`}
            />

            <div className="mt-2.5 border-t border-border pt-2">
              <span className={`catalog block ${active ? "text-accent" : ""}`}>
                {catalogNo("LP", index)}
              </span>
              <b
                className={`mt-1.5 block truncate text-[0.8125rem] font-semibold ${
                  active ? "text-text-primary" : "text-text-secondary"
                }`}
              >
                {album.title}
              </b>
              <span className="data mt-0.5 block text-text-muted">
                {album.plays.toLocaleString("pt-BR")} audições
              </span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
