"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bookmark, Check, Pause, Play, SkipForward, ThumbsUp } from "lucide-react";
import { ResilientCover } from "@/components/ui/resilient-cover";
import { EASE_OUT_EXPO } from "@/components/ui/motion";
import { usePreviewPlayer } from "./use-preview-player";

export interface StageCandidate {
  id: string;
  artistName: string;
  trackName: string;
  albumName: string | null;
  coverUrl?: string | null;
  previewUrl?: string | null;
  genre: string | null;
  score: number;
  reason: string | null;
  position: { proximity: number; fame: number } | null;
}

export type StageAction = "liked" | "saved" | "known" | "skipped";

interface StageProps {
  queue: StageCandidate[];
  index: number;
  onAction: (candidate: StageCandidate, action: StageAction) => void;
}

/** Anel que corre em volta da capa enquanto a prévia toca. */
function ProgressRing({ progress }: { progress: number }) {
  const radius = 49;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg viewBox="0 0 100 100" className="pointer-events-none absolute -inset-2 h-[calc(100%+1rem)] w-[calc(100%+1rem)] -rotate-90">
      <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="0.7" className="text-border" />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        className="text-accent"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
      />
    </svg>
  );
}

/** Onde a sugestão caiu nos mesmos eixos que a pessoa regulou. */
function PositionPlot({ position }: { position: { proximity: number; fame: number } }) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative h-11 w-11 shrink-0 rounded-sm border border-border">
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
        <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
        <motion.span
          className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
          animate={{ left: `${position.proximity}%`, top: `${100 - position.fame}%` }}
          transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
        />
      </span>
      <span className="font-mono text-[9.5px] leading-relaxed text-text-muted">
        proximidade {position.proximity}
        <br />
        fama {position.fame}
      </span>
    </div>
  );
}

export function DiscoveryStage({ queue, index, onAction }: StageProps) {
  const reduced = useReducedMotion();
  const current = queue[index];
  const upcoming = queue.slice(index + 1, index + 4);
  const player = usePreviewPlayer(current?.previewUrl);

  // teclado: espaço toca, setas decidem — igual a qualquer player
  useEffect(() => {
    if (!current) return;

    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (event.code === "Space") {
        event.preventDefault();
        player.toggle();
      } else if (event.code === "ArrowRight") {
        event.preventDefault();
        onAction(current, "skipped");
      } else if (event.code === "ArrowUp") {
        event.preventDefault();
        onAction(current, "liked");
      } else if (event.code === "ArrowDown") {
        event.preventDefault();
        onAction(current, "saved");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, player, onAction]);

  // trocar de faixa não deve deixar a anterior tocando
  useEffect(() => player.stop, [current?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null;

  const decide = (action: StageAction) => {
    player.stop();
    onAction(current, action);
  };

  return (
    <div className="relative mx-auto flex w-full max-w-[420px] flex-col items-center">
      {/* as próximas ficam atrás, dando profundidade à fila */}
      <div className="relative w-full" style={{ perspective: 1200 }}>
        {upcoming.map((entry, depth) => (
          <motion.div
            key={entry.id}
            className="pointer-events-none absolute inset-x-0 top-0"
            initial={false}
            animate={{
              scale: 1 - (depth + 1) * 0.05,
              y: -(depth + 1) * 14,
              opacity: 0.5 - depth * 0.15,
            }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
            style={{ zIndex: -depth - 1 }}
          >
            <div className="aspect-square w-full rounded-sm bg-surface-elevated ring-1 ring-border" />
          </motion.div>
        ))}

        <AnimatePresence mode="popLayout">
          <motion.div
            key={current.id}
            className="relative"
            initial={reduced ? false : { opacity: 0, scale: 0.9, y: 26 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.94, x: -60, rotate: -4 }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
          >
            <button
              type="button"
              onClick={player.toggle}
              disabled={!player.available}
              aria-label={player.playing ? "Pausar prévia" : "Tocar prévia"}
              className="group relative block w-full disabled:cursor-default"
            >
              <ResilientCover
                src={current.coverUrl}
                alt={`Capa de ${current.albumName ?? current.trackName}`}
                label={current.albumName ?? current.artistName}
                priority
                className="aspect-square w-full rounded-sm shadow-lift ring-1 ring-white/[0.07]"
                imageClassName={player.playing ? "scale-[1.02] transition-transform duration-700" : "transition-transform duration-700"}
              />

              {player.available && <ProgressRing progress={player.progress} />}

              <span
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                  player.playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"
                }`}
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-background/75 backdrop-blur-sm ring-1 ring-white/15">
                  {player.available ? (
                    player.playing ? (
                      <Pause className="h-6 w-6" />
                    ) : (
                      <Play className="ml-0.5 h-6 w-6" />
                    )
                  ) : (
                    <span className="font-mono text-[9px] text-text-muted">sem prévia</span>
                  )}
                </span>
              </span>
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          className="mt-7 w-full text-center"
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
        >
          <h2 className="display-lg text-[clamp(1.5rem,4vw,2.1rem)]">{current.artistName}</h2>
          <p className="mt-1.5 text-sm text-text-secondary">{current.trackName}</p>
          {current.genre && <p className="mt-2 font-mono text-[10px] text-accent">{current.genre}</p>}

          {current.reason && (
            <p className="mx-auto mt-5 max-w-[38ch] text-xs leading-relaxed text-text-muted">{current.reason}</p>
          )}

          {current.position && (
            <div className="mt-5 flex justify-center">
              <PositionPlot position={current.position} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex items-center gap-3">
        <motion.button
          type="button"
          onClick={() => decide("known")}
          whileTap={{ scale: 0.9 }}
          title="Já conheço"
          aria-label="Já conheço"
          className="rounded-full border border-border p-3 text-text-muted transition-colors hover:border-text-muted hover:text-text-secondary"
        >
          <Check className="h-4 w-4" />
        </motion.button>

        <motion.button
          type="button"
          onClick={() => decide("skipped")}
          whileTap={{ scale: 0.9 }}
          title="Pular (→)"
          aria-label="Pular"
          className="rounded-full border border-border p-4 text-text-secondary transition-colors hover:border-text-primary hover:text-text-primary"
        >
          <SkipForward className="h-5 w-5" />
        </motion.button>

        <motion.button
          type="button"
          onClick={() => decide("liked")}
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.06 }}
          title="Curti (↑)"
          aria-label="Curti"
          className="rounded-full bg-accent p-5 text-background shadow-glow"
        >
          <ThumbsUp className="h-6 w-6" />
        </motion.button>

        <motion.button
          type="button"
          onClick={() => decide("saved")}
          whileTap={{ scale: 0.9 }}
          title="Guardar (↓)"
          aria-label="Guardar"
          className="rounded-full border border-border p-4 text-text-secondary transition-colors hover:border-accent hover:text-accent"
        >
          <Bookmark className="h-5 w-5" />
        </motion.button>
      </div>

      <p className="mt-5 font-mono text-[9.5px] text-text-muted">
        espaço toca · ↑ curtir · ↓ guardar · → pular
      </p>
    </div>
  );
}
