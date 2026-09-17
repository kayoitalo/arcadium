"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ResilientCover } from "@/components/ui/resilient-cover";
import type { AlbumItem } from "@/modules/statistics/application/overview-service";

interface CoverWallProps {
  albums: AlbumItem[];
  selectedIndex: number;
  /** O disco na agulha está tocando a prévia agora. */
  playing: boolean;
  onSelect: (index: number) => void;
}

/** A grade tem 2 ou 4 colunas; completar até 4 fecha as duas sem buraco. */
const RACK_COLUMNS = 4;

/**
 * O rack do período: capas encostadas na grade, sem vão entre elas. O
 * disco que está na agulha fica com o LED aceso; escolher outro troca o
 * que toca na vitrola lá em cima — e, se ele tiver prévia, já toca.
 */
export function CoverWall({ albums, selectedIndex, playing, onSelect }: CoverWallProps) {
  const reduced = useReducedMotion();
  if (!albums.length) return null;

  const fillers = (RACK_COLUMNS - (albums.length % RACK_COLUMNS)) % RACK_COLUMNS;

  return (
    <div className="ruled mt-6 grid-cols-2 border border-border sm:grid-cols-4">
      {albums.map((album, index) => {
        const active = index === selectedIndex;
        const sounding = active && playing;
        return (
          <motion.button
            key={`${album.id ?? album.title}-${index}`}
            type="button"
            onClick={() => onSelect(index)}
            aria-pressed={active}
            aria-label={`Pôr na agulha: ${album.title}, de ${album.artistName}${album.previewUrl ? " (toca a prévia)" : ""}`}
            className="group flex cursor-pointer flex-col border-0 bg-background p-0 text-left transition-colors duration-150 hover:bg-surface active:bg-well"
            initial={reduced ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3, delay: index * 0.03 }}
          >
            <ResilientCover
              src={album.coverUrl}
              alt={`Capa de ${album.title}`}
              label={album.title}
              caption={false}
              className="aspect-square w-full"
              imageClassName={
                active
                  ? ""
                  : "brightness-[.72] saturate-[.8] transition-[filter] duration-150 group-hover:brightness-100 group-hover:saturate-100"
              }
            />

            <span className="flex w-full items-start justify-between gap-3 border-t border-rule px-3 py-3">
              <span className="min-w-0">
                <span className={`block truncate text-[13px] ${active ? "text-text-primary" : "text-text-secondary"}`}>
                  {album.title}
                </span>
                <span className="mt-0.5 block truncate text-xs text-text-muted">{album.artistName}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1.5 pt-1">
                <span className="flex items-center gap-2">
                  <span className="data text-text-label">{album.plays.toLocaleString("pt-BR")}</span>
                  <span className="led" data-on={active} aria-hidden />
                </span>
                {album.previewUrl && (
                  <span className={`micro ${sounding ? "text-accent" : ""}`}>{sounding ? "tocando" : "prévia"}</span>
                )}
              </span>
            </span>
          </motion.button>
        );
      })}

      {Array.from({ length: fillers }, (_, index) => (
        <div key={`vazio-${index}`} className="hidden bg-background sm:block" aria-hidden />
      ))}
    </div>
  );
}
