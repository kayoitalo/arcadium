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
      <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border" />
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
          className="absolute h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 bg-accent"
          animate={{ left: `${position.proximity}%`, top: `${100 - position.fame}%` }}
          transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
        />
      </span>
      <span className="catalog leading-relaxed">
        proximidade {String(position.proximity).padStart(3, "0")}
        <br />
        fama {String(position.fame).padStart(3, "0")}
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
      <div className="mb-4 flex w-full items-baseline justify-between gap-4 border-b border-border pb-2">
        <span className="catalog text-accent">
          GY·TP-{String(index + 1).padStart(3, "0")}
        </span>
        <span className="catalog">
          {player.available ? "prévia 30s" : "sem prévia"} · afinidade{" "}
          {Math.round(current.score * 100) / 100}
        </span>
      </div>

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
            <div className="aspect-square w-full border border-border bg-surface-elevated" />
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
                className="aspect-square w-full border border-border shadow-lift"
                imageClassName={player.playing ? "scale-[1.02] transition-transform duration-700" : "transition-transform duration-700"}
              />

              {player.available && <ProgressRing progress={player.progress} />}

              <span
                className={`absolute inset-0 flex items-center justify-center transition-opacity duration-300 ${
                  player.playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"
                }`}
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full border border-paper/20 bg-background/80 backdrop-blur-sm">
                  {player.available ? (
                    player.playing ? (
                      <Pause className="h-6 w-6" />
                    ) : (
                      <Play className="ml-0.5 h-6 w-6" />
                    )
                  ) : (
                    <span className="catalog">sem prévia</span>
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
          <h2 className="headline text-[clamp(1.5rem,4vw,2.1rem)]">{current.artistName}</h2>
          <p className="mt-2 text-sm text-text-secondary">{current.trackName}</p>
          {current.genre && (
            <p className="catalog mt-2.5 block text-accent">
              <span className="text-border">[</span> {current.genre} <span className="text-border">]</span>
            </p>
          )}

          {current.reason && (
            <p className="liner mx-auto mt-5 max-w-[40ch] text-[0.9375rem]">{current.reason}</p>
          )}

          {current.position && (
            <div className="mt-5 flex justify-center">
              <PositionPlot position={current.position} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-9 grid w-full grid-cols-2 divide-x divide-y divide-border border border-border sm:grid-cols-4 sm:divide-y-0">
        <button
          type="button"
          onClick={() => decide("known")}
          title="Já conheço"
          className="stamp justify-center border-0 !px-2 text-text-muted"
        >
          <Check className="h-3.5 w-3.5" />
          conheço
        </button>

        <button
          type="button"
          onClick={() => decide("skipped")}
          title="Pular (→)"
          className="stamp justify-center border-0 !px-2 text-text-secondary"
        >
          <SkipForward className="h-3.5 w-3.5" />
          pular
        </button>

        <button
          type="button"
          onClick={() => decide("saved")}
          title="Guardar (↓)"
          className="stamp justify-center border-0 !px-2"
        >
          <Bookmark className="h-3.5 w-3.5" />
          guardar
        </button>

        <button
          type="button"
          onClick={() => decide("liked")}
          title="Curti (↑)"
          className="stamp stamp-ink justify-center border-0 !px-2"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          curti
        </button>
      </div>

      <p className="catalog mt-5 block">espaço toca · ↑ curtir · ↓ guardar · → pular</p>
    </div>
  );
}
