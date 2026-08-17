"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import type { AlbumItem } from "@/modules/statistics/application/overview-service";
import { ResilientCover } from "@/components/ui/resilient-cover";

export function DynamicAlbumHero({ albums }: { albums: AlbumItem[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const x = useSpring(pointerX, { stiffness: 90, damping: 20 });
  const y = useSpring(pointerY, { stiffness: 90, damping: 20 });
  const rotateY = useTransform(x, [-0.5, 0.5], [-3, 3]);
  const rotateX = useTransform(y, [-0.5, 0.5], [3, -3]);
  const visible = albums.slice(0, 3);

  const move = (event: React.MouseEvent<HTMLDivElement>) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return;
    pointerX.set((event.clientX - bounds.left) / bounds.width - 0.5);
    pointerY.set((event.clientY - bounds.top) / bounds.height - 0.5);
  };

  return <div ref={ref} onMouseMove={move} onMouseLeave={() => { pointerX.set(0); pointerY.set(0); }} className="relative h-[300px] w-full overflow-hidden rounded-3xl border border-border/60 bg-surface/35 p-5 sm:h-[340px]">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(180,122,70,0.16),transparent_48%)]" />
    <div className="absolute inset-0 bg-[radial-gradient(#332c25_1px,transparent_1px)] [background-size:24px_24px] opacity-20" />
    <div className="relative z-10 flex items-center justify-between"><div><span className="eyebrow">ÁLBUNS DO PERÍODO</span><p className="mt-1 text-xs text-text-secondary">Composição baseada no número de audições</p></div>{visible[0] && <span className="rounded-full border border-accent/30 bg-background/60 px-3 py-1 text-[10px] font-mono text-accent-gold">{visible[0].plays} AUDIÇÕES</span>}</div>

    {!visible.length ? <div className="relative flex h-[230px] items-center justify-center text-center"><div><p className="font-serif text-xl text-text-primary">Nenhum álbum neste período</p><p className="mt-2 text-xs text-text-muted">As capas aparecerão conforme os eventos forem sincronizados.</p></div></div> :
      <motion.div style={{ rotateX, rotateY, perspective: 1000 }} className="relative mx-auto mt-1 h-[250px] max-w-xl sm:h-[285px]">
        {visible[2] && <motion.div initial={{ opacity: 0, x: 30, rotate: 0 }} animate={{ opacity: 0.72, x: 0, rotate: 7 }} transition={{ delay: 0.12 }} className="absolute right-[4%] top-10 w-36 sm:right-[8%] sm:w-44"><ResilientCover src={visible[2].coverUrl} alt={visible[2].title} label={visible[2].title} className="aspect-square rounded-xl border border-border shadow-magazine" /></motion.div>}
        {visible[1] && <motion.div initial={{ opacity: 0, x: -30, rotate: 0 }} animate={{ opacity: 0.82, x: 0, rotate: -6 }} transition={{ delay: 0.06 }} className="absolute left-[4%] top-9 w-40 sm:left-[8%] sm:w-48"><ResilientCover src={visible[1].coverUrl} alt={visible[1].title} label={visible[1].title} className="aspect-square rounded-xl border border-border shadow-magazine" /></motion.div>}
        <motion.div initial={{ opacity: 0, y: 18, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.45 }} className="absolute left-1/2 top-5 w-48 -translate-x-1/2 sm:w-56">
          <ResilientCover src={visible[0].coverUrl} alt={visible[0].title} label={visible[0].title} priority className="aspect-square rounded-2xl border border-accent/50 shadow-[0_24px_55px_rgba(0,0,0,.75),0_0_30px_rgba(180,122,70,.16)]" />
          <div className="absolute inset-x-0 bottom-0 rounded-b-2xl bg-gradient-to-t from-background via-background/85 to-transparent p-4 pt-12"><strong className="block truncate font-serif text-sm text-text-primary">{visible[0].title}</strong><span className="block truncate text-[10px] font-mono text-accent-gold">{visible[0].artistName}</span></div>
        </motion.div>
      </motion.div>}
  </div>;
}
