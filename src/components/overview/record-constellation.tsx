"use client";

import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { ResilientCover } from "@/components/ui/resilient-cover";
import { EASE_OUT_EXPO, SPRING_SOFT } from "@/components/ui/motion";
import type { AlbumItem } from "@/modules/statistics/application/overview-service";

interface ConstellationProps {
  albums: AlbumItem[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}

/**
 * Posições fixas em vez de aleatórias: a constelação precisa ser a mesma
 * a cada carregamento, senão a tela "pisca" diferente toda visita. Cada
 * disco tem profundidade própria, e é a profundidade que define o quanto
 * ele se move com o ponteiro — é daí que vem a sensação de espaço.
 */
const ORBITS = [
  { x: 0, y: 0, size: 1, depth: 1, delay: 0 },
  { x: -62, y: -34, size: 0.52, depth: 0.45, delay: 0.6 },
  { x: 58, y: -46, size: 0.44, depth: 0.3, delay: 1.2 },
  { x: 66, y: 40, size: 0.5, depth: 0.55, delay: 0.3 },
  { x: -54, y: 46, size: 0.4, depth: 0.25, delay: 0.9 },
];

export function RecordConstellation({ albums, selectedIndex, onSelect }: ConstellationProps) {
  const reduced = useReducedMotion();
  const stageRef = useRef<HTMLDivElement>(null);

  const pointerX = useSpring(useMotionValue(0), SPRING_SOFT);
  const pointerY = useSpring(useMotionValue(0), SPRING_SOFT);

  if (albums.length === 0) return null;

  // o disco escolhido no centro, os outros em volta
  const ordered = [
    albums[selectedIndex],
    ...albums.filter((_, index) => index !== selectedIndex),
  ].slice(0, ORBITS.length);

  return (
    <div
      ref={stageRef}
      className="relative mx-auto aspect-square w-full max-w-[460px]"
      style={{ perspective: 1000 }}
      onPointerMove={(event) => {
        if (reduced) return;
        const bounds = stageRef.current?.getBoundingClientRect();
        if (!bounds) return;
        pointerX.set((event.clientX - bounds.left) / bounds.width - 0.5);
        pointerY.set((event.clientY - bounds.top) / bounds.height - 0.5);
      }}
      onPointerLeave={() => {
        pointerX.set(0);
        pointerY.set(0);
      }}
    >
      {ordered.map((album, position) => {
        const orbit = ORBITS[position];
        const albumIndex = albums.indexOf(album);
        const isCenter = position === 0;

        return (
          <Disc
            key={`${album.id ?? album.title}-${position}`}
            album={album}
            orbit={orbit}
            isCenter={isCenter}
            reduced={Boolean(reduced)}
            pointerX={pointerX}
            pointerY={pointerY}
            onSelect={() => onSelect(albumIndex)}
          />
        );
      })}
    </div>
  );
}

function Disc({
  album,
  orbit,
  isCenter,
  reduced,
  pointerX,
  pointerY,
  onSelect,
}: {
  album: AlbumItem;
  orbit: (typeof ORBITS)[number];
  isCenter: boolean;
  reduced: boolean;
  pointerX: ReturnType<typeof useSpring>;
  pointerY: ReturnType<typeof useSpring>;
  onSelect: () => void;
}) {
  // quanto mais raso o disco, mais ele desliza — paralaxe de verdade
  const translateX = useTransform(pointerX, (value) => value * 54 * (1 - orbit.depth + 0.25));
  const translateY = useTransform(pointerY, (value) => value * 54 * (1 - orbit.depth + 0.25));
  const rotateY = useTransform(pointerX, (value) => value * (isCenter ? 16 : 9));
  const rotateX = useTransform(pointerY, (value) => -value * (isCenter ? 16 : 9));

  const side = isCenter ? 62 : orbit.size * 62;

  return (
    <motion.button
      type="button"
      onClick={onSelect}
      aria-label={`Focar em ${album.title}, de ${album.artistName}`}
      className="absolute rounded-sm focus-visible:outline-2"
      style={{
        left: `${50 + orbit.x / 2}%`,
        top: `${50 + orbit.y / 2}%`,
        width: `${side}%`,
        x: translateX,
        y: translateY,
        rotateX,
        rotateY,
        translateX: "-50%",
        translateY: "-50%",
        zIndex: isCenter ? 10 : Math.round(orbit.depth * 8),
        transformStyle: "preserve-3d",
      }}
      initial={reduced ? false : { opacity: 0, scale: 0.7 }}
      animate={
        reduced
          ? { opacity: 1, scale: 1 }
          : {
              opacity: isCenter ? 1 : 0.42 + orbit.depth * 0.3,
              scale: 1,
              // respiração lenta: cada disco no seu tempo, senão vira pisca-pisca
              y: [0, isCenter ? -8 : -14, 0],
            }
      }
      transition={{
        opacity: { duration: 0.9, ease: EASE_OUT_EXPO, delay: orbit.delay * 0.2 },
        scale: { duration: 0.9, ease: EASE_OUT_EXPO, delay: orbit.delay * 0.2 },
        y: {
          duration: 7 + orbit.delay * 2,
          repeat: Infinity,
          repeatType: "loop",
          ease: "easeInOut",
          delay: orbit.delay,
        },
      }}
      whileHover={reduced ? undefined : { scale: 1.06, opacity: 1 }}
      whileTap={{ scale: 0.97 }}
    >
      <ResilientCover
        src={album.coverUrl}
        alt={`Capa de ${album.title}`}
        label={album.title}
        priority={isCenter}
        className={`aspect-square w-full rounded-sm ${
          isCenter ? "shadow-lift ring-1 ring-white/[0.08]" : "ring-1 ring-white/[0.04]"
        }`}
        imageClassName={isCenter ? "" : "saturate-[.7] brightness-[.78]"}
      />

      {isCenter && (
        <motion.span
          className="pointer-events-none absolute -inset-3 -z-10 rounded-full"
          style={{ background: "radial-gradient(closest-side, var(--chroma-glow), transparent 72%)" }}
          animate={reduced ? undefined : { opacity: [0.5, 0.95, 0.5], scale: [0.96, 1.06, 0.96] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </motion.button>
  );
}
