"use client";

import { motion } from "framer-motion";
import { Disc3, Headphones } from "lucide-react";
import type { AlbumItem, TopArtistItem } from "@/modules/statistics/application/overview-service";
import { ResilientCover } from "@/components/ui/resilient-cover";

export function PeriodSpotlight({ album, artist, loading }: { album?: AlbumItem; artist?: TopArtistItem; loading: boolean }) {
  if (loading) return <div className="h-full min-h-64 animate-pulse rounded-3xl border border-border/50 bg-surface/30" />;
  if (!album && !artist) return <div className="flex min-h-64 items-center justify-center rounded-3xl border border-dashed border-border/70 bg-surface/25 p-8 text-center text-sm text-text-muted">O destaque aparecerá após a primeira sincronização.</div>;
  return <motion.aside layout className="relative min-h-64 overflow-hidden rounded-3xl border border-border/70 bg-surface/45 p-5 shadow-card">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,rgba(197,154,96,0.14),transparent_42%)]" />
    <div className="relative flex h-full flex-col justify-between gap-5">
      <div className="flex items-center justify-between"><div><span className="eyebrow">A FAIXA QUE DEFINIU O PERÍODO</span><p className="mt-1 text-xs text-text-secondary">Seu álbum mais ouvido</p></div><Headphones className="h-4 w-4 text-accent-gold" /></div>
      <div className="grid grid-cols-[7rem_1fr] items-end gap-4 sm:grid-cols-[9rem_1fr]">
        <ResilientCover src={album?.coverUrl} alt={album?.title || artist?.name || "Destaque"} label={album?.title || artist?.name} priority className="aspect-square rounded-2xl border border-border/80 shadow-magazine" />
        <div className="min-w-0 pb-1">
          <Disc3 className="mb-3 h-4 w-4 text-accent-gold" />
          <h2 className="font-serif text-2xl leading-tight text-text-primary">{album?.title || artist?.name}</h2>
          <p className="mt-1 truncate text-xs text-text-secondary">{album?.artistName || "Artista mais ouvido"}</p>
          <div className="mt-4 flex items-end justify-between border-t border-border/60 pt-3"><span className="text-[10px] font-mono text-text-muted">AUDIÇÕES</span><strong className="font-serif text-2xl text-accent-gold">{album?.plays ?? artist?.plays ?? 0}</strong></div>
        </div>
      </div>
    </div>
  </motion.aside>;
}
