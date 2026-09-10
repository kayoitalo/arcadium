"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bookmark, Check, Pause, Play, SkipForward, ThumbsUp } from "lucide-react";
import { ResilientCover } from "@/components/ui/resilient-cover";
import { EASE_OUT_EXPO } from "@/components/ui/motion";
import { formatGenre } from "@/lib/format/genre";
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
  const circumference = 2 * Math.PI * 49;

  return (
    <svg
      viewBox="0 0 100 100"
      className="pointer-events-none absolute -inset-2.5 h-[calc(100%+20px)] w-[calc(100%+20px)] -rotate-90"
      aria-hidden
    >
      <circle cx="50" cy="50" r="49" fill="none" stroke="#1b2129" strokeWidth="0.7" />
      <circle
        cx="50"
        cy="50"
        r="49"
        fill="none"
        stroke="var(--chroma)"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
        style={{ transition: "stroke-dashoffset 400ms linear" }}
      />
    </svg>
  );
}

/** Um botão de decisão: o círculo em cima, o que ele faz embaixo. */
function ActionButton({
  onClick,
  label,
  hint,
  size,
  primary = false,
  children,
}: {
  onClick: () => void;
  label: string;
  hint: string;
  size: number;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="group flex cursor-pointer flex-col items-center gap-2 border-0 bg-transparent"
    >
      <span
        className={`flex items-center justify-center rounded-full transition-[transform,color,border-color] duration-300 group-hover:-translate-y-1 ${
          primary
            ? "text-background shadow-glow group-hover:scale-105"
            : "border border-border text-text-secondary group-hover:border-text-primary group-hover:text-text-primary"
        }`}
        style={{
          height: size,
          width: size,
          background: primary ? "var(--chroma)" : undefined,
        }}
      >
        {children}
      </span>
      <span
        className="data uppercase tracking-[0.1em] text-[8.5px]"
        style={{ color: primary ? "var(--chroma)" : "#8b959e" }}
      >
        {hint}
      </span>
    </button>
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
    <div className="flex w-full flex-col items-center">
      {/* as próximas ficam atrás, dando profundidade à fila */}
      <div className="relative w-full max-w-[460px]" style={{ perspective: 1300 }}>
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
            transition={{ duration: 0.56, ease: EASE_OUT_EXPO }}
            style={{ zIndex: -depth - 1 }}
          >
            <div className="aspect-square w-full rounded-[3px] bg-surface ring-1 ring-rule" />
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
              className="group relative block w-full cursor-pointer border-0 bg-transparent p-0 disabled:cursor-default"
            >
              <span className="relative block aspect-square w-full overflow-hidden rounded-[3px] shadow-lift ring-1 ring-white/[0.07]">
                <ResilientCover
                  src={current.coverUrl}
                  alt={`Capa de ${current.albumName ?? current.trackName}`}
                  label={current.albumName ?? current.artistName}
                  priority
                  className="h-full w-full"
                  imageClassName={
                    player.playing ? "scale-[1.02] transition-transform duration-700" : "transition-transform duration-700"
                  }
                />

                {/* rótulo de disco no centro, girando enquanto toca */}
                <span
                  className="absolute left-1/2 top-1/2 flex aspect-square w-[34%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-full p-[6%] text-center"
                  style={{
                    background: "var(--chroma)",
                    boxShadow: "0 3px 14px rgb(0 0 0 / 0.55)",
                    animation: player.playing && !reduced ? "gy-spin 4s linear infinite" : undefined,
                  }}
                >
                  <b className="data truncate text-[8px] font-semibold uppercase tracking-[0.12em] text-black/60">
                    {current.artistName}
                  </b>
                  <span className="line-clamp-2 text-[11px] leading-tight text-black/80">
                    {current.albumName ?? current.trackName}
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-background" />
                </span>

                <span
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(118deg, rgb(255 255 255 / 0.08) 0%, transparent 34%, transparent 64%, rgb(255 255 255 / 0.05) 100%)",
                  }}
                />
              </span>

              {player.available && <ProgressRing progress={player.progress} />}

              {player.available ? (
                <span
                  className={`absolute inset-0 flex items-end justify-center pb-[8%] transition-opacity duration-300 ${
                    player.playing ? "opacity-0 group-hover:opacity-100" : "opacity-100"
                  }`}
                >
                  <span className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-background/80 ring-1 ring-white/15 backdrop-blur-sm">
                    {player.playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                  </span>
                </span>
              ) : (
                <span className="data absolute bottom-3 left-3 rounded-full bg-background/80 px-2.5 py-1 text-text-muted backdrop-blur-sm">
                  sem prévia
                </span>
              )}
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          className="mt-8 w-full max-w-[500px] text-center"
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
        >
          {current.genre && (
            <span className="data inline-flex items-center gap-2 rounded-full border border-border-glow px-3 py-1 text-accent">
              <span className="h-[5px] w-[5px] rounded-full bg-accent" />
              {formatGenre(current.genre)}
            </span>
          )}

          <h2 className="display mt-4 text-[clamp(1.8rem,4vw,2.6rem)]">{current.artistName}</h2>
          <p className="mt-2 text-[15px] text-text-secondary">{current.trackName}</p>

          {current.reason && (
            <p className="mx-auto mt-5 max-w-[44ch] border-l-2 border-border-glow pl-3.5 text-left text-[13px] leading-[1.66] text-text-secondary">
              {current.reason}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-9 flex items-start gap-3.5">
        <ActionButton onClick={() => decide("known")} label="Já conheço" hint="conheço" size={44}>
          <Check className="h-4 w-4" />
        </ActionButton>
        <ActionButton onClick={() => decide("skipped")} label="Pular" hint="pular →" size={54}>
          <SkipForward className="h-5 w-5" />
        </ActionButton>
        <ActionButton onClick={() => decide("liked")} label="Curti" hint="curtir ↑" size={72} primary>
          <ThumbsUp className="h-6 w-6" />
        </ActionButton>
        <ActionButton onClick={() => decide("saved")} label="Guardar" hint="guardar ↓" size={54}>
          <Bookmark className="h-5 w-5" />
        </ActionButton>
      </div>

      <p className="data mt-6 text-text-label">espaço toca a prévia</p>
    </div>
  );
}
