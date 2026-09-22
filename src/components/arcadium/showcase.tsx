"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useAnimationFrame, useMotionValue, useReducedMotion, type MotionValue } from "framer-motion";
import { ResilientCover } from "@/components/ui/resilient-cover";
import { GREEN, MAGENTA } from "@/components/arcadium/tokens";
import type { AlbumItem } from "@/modules/statistics/application/overview-service";

/** Tempo parado até a máquina começar a se exibir sozinha. */
const ATTRACT_AFTER_MS = 10_000;
/** Passo do attract mode: um disco a cada tanto. */
const ATTRACT_STEP_MS = 3_000;
/** Velocidade das esteiras, em px por segundo. */
const DRIFT_SPEED = 26;

/**
 * O mostruário: duas esteiras andando em sentidos opostos, sem começo nem
 * fim. Parar o mouse em cima trava aquela esteira e põe o disco em foco;
 * clicar põe na agulha.
 *
 * É o que dá vida à tela parada — e substitui o rack, que era um
 * aglomerado pequeno no meio de muito preto.
 */
export function Showcase({
  albums,
  focused,
  onFocus,
  onPick,
  loadedTitle,
  bass,
}: {
  albums: AlbumItem[];
  focused: number;
  onFocus: (index: number) => void;
  onPick: (index: number) => void;
  loadedTitle?: string;
  bass: MotionValue<number>;
}) {
  const reduced = useReducedMotion();
  const [attract, setAttract] = useState(false);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wake = useCallback(() => {
    setAttract(false);
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => setAttract(true), ATTRACT_AFTER_MS);
  }, []);

  useEffect(() => {
    wake();
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "wheel", "pointermove"];
    for (const event of events) window.addEventListener(event, wake, { passive: true });
    return () => {
      for (const event of events) window.removeEventListener(event, wake);
      if (idle.current) clearTimeout(idle.current);
    };
  }, [wake]);

  useEffect(() => {
    if (!attract || reduced || albums.length === 0) return;
    const timer = setInterval(() => onFocus((focused + 1) % albums.length), ATTRACT_STEP_MS);
    return () => clearInterval(timer);
  }, [attract, reduced, albums.length, focused, onFocus]);

  const withCover = albums.filter((album) => album.coverUrl);
  const top = withCover.filter((_, index) => index % 2 === 0);
  const bottom = withCover.filter((_, index) => index % 2 === 1);
  const indexOf = (album: AlbumItem) => albums.indexOf(album);

  return (
    <div className="relative">
      <p
        className="font-mono text-[10px] uppercase tracking-[0.2em]"
        style={{ color: attract ? MAGENTA : "#79838c", position: "absolute", right: 0, top: -28 }}
      >
        {attract ? "girando sozinho — passe o mouse pra assumir" : "clique para pôr na agulha"}
      </p>

      <Belt
        albums={top}
        direction={-1}
        size={186}
        focusedTitle={albums[focused]?.title}
        loadedTitle={loadedTitle}
        onHover={(album) => onFocus(indexOf(album))}
        onPick={(album) => onPick(indexOf(album))}
        bass={bass}
      />
      <div className="h-5" />
      <Belt
        albums={bottom}
        direction={1}
        size={144}
        focusedTitle={albums[focused]?.title}
        loadedTitle={loadedTitle}
        onHover={(album) => onFocus(indexOf(album))}
        onPick={(album) => onPick(indexOf(album))}
        bass={bass}
      />
    </div>
  );
}

/** Uma esteira: a lista sai duplicada, e o x volta ao zero sem emenda. */
function Belt({
  albums,
  direction,
  size,
  focusedTitle,
  loadedTitle,
  onHover,
  onPick,
  bass,
}: {
  albums: AlbumItem[];
  direction: 1 | -1;
  size: number;
  focusedTitle?: string;
  loadedTitle?: string;
  onHover: (album: AlbumItem) => void;
  onPick: (album: AlbumItem) => void;
  bass: MotionValue<number>;
}) {
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const paused = useRef(false);
  const gap = 20;
  const span = albums.length * (size + gap);

  useAnimationFrame((_, delta) => {
    if (reduced || paused.current || span === 0) return;
    /** A vitrine anda sozinha, e o grave empurra: até 2,4× no pico. */
    const speed = DRIFT_SPEED * (1 + bass.get() * 1.4);
    const next = x.get() + direction * speed * (delta / 1000);
    x.set(direction < 0 ? (next <= -span ? next + span : next) : next >= 0 ? next - span : next);
  });

  return (
    <div
      className="relative overflow-hidden"
      onPointerEnter={() => {
        paused.current = true;
      }}
      onPointerLeave={() => {
        paused.current = false;
      }}
    >
      <motion.div className="flex" style={{ x, gap, width: "max-content" }}>
        {[...albums, ...albums].map((album, index) => {
          const isFocused = album.title === focusedTitle;
          const isLoaded = album.title === loadedTitle;
          return (
            <button
              key={`${album.title}-${index}`}
              type="button"
              onPointerEnter={() => onHover(album)}
              onFocus={() => onHover(album)}
              onClick={() => onPick(album)}
              className="relative shrink-0 outline-none"
              style={{ width: size, height: size }}
              aria-label={`pôr ${album.title} na agulha`}
            >
              <motion.div
                animate={{ scale: isFocused ? 1.06 : 1, opacity: isFocused ? 1 : 0.42 }}
                transition={{ type: "spring", stiffness: 220, damping: 24 }}
                className="relative h-full w-full"
                style={
                  isFocused ? { boxShadow: "0 0 0 2px var(--chroma), 0 26px 50px -26px rgb(0 0 0 / 0.9)" } : undefined
                }
              >
                <ResilientCover
                  src={album.coverUrl}
                  alt={album.title}
                  label={album.title}
                  className="h-full w-full"
                  caption={false}
                  compact
                />
                {isLoaded && (
                  <span
                    className="absolute left-0 top-0 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.2em]"
                    style={{ background: GREEN, color: "#08090b" }}
                  >
                    na agulha
                  </span>
                )}
                {!album.previewUrl && (
                  <span className="absolute bottom-0 right-0 bg-[rgb(8_9_11/0.85)] px-2 py-1 font-mono text-[9px] text-text-muted">
                    sem prévia
                  </span>
                )}
              </motion.div>
            </button>
          );
        })}
      </motion.div>
    </div>
  );
}
