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
 * Os discos do período. Escolher um traz a capa para o topo e tinge
 * a interface inteira com a cor dela.
 */
export function CoverWall({ albums, selectedIndex, onSelect }: CoverWallProps) {
  const reduced = useReducedMotion();
  if (!albums.length) return null;

  return (
    <div className="flex snap-x gap-3 overflow-x-auto pb-3">
      {albums.map((album, index) => {
        const active = index === selectedIndex;
        return (
          <motion.button
            key={`${album.id ?? album.title}-${index}`}
            type="button"
            onClick={() => onSelect(index)}
            aria-pressed={active}
            aria-label={`Focar em ${album.title}, de ${album.artistName}`}
            className="group relative w-[132px] shrink-0 snap-start rounded-sm sm:w-[152px]"
            initial={reduced ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT_EXPO, delay: index * 0.05 }}
            whileHover={reduced ? undefined : { y: -8 }}
            whileTap={{ scale: 0.98 }}
          >
            <ResilientCover
              src={album.coverUrl}
              alt={`Capa de ${album.title}`}
              label={album.title}
              className={`aspect-square w-full rounded-sm transition-all duration-500 ${
                active ? "ring-1 ring-accent shadow-glow" : "ring-1 ring-white/[0.05]"
              }`}
              imageClassName={`transition-[filter] duration-500 ${
                active ? "saturate-110" : "saturate-[.65] brightness-[.72] group-hover:saturate-100 group-hover:brightness-100"
              }`}
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2.5 pt-8 text-left">
              <b className="block truncate text-[11px] font-semibold text-white">{album.title}</b>
              <span className="font-mono text-[9px] text-white/65">{album.plays} audições</span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
