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

/** As prévias do iTunes têm 30 segundos: um segmento por segundo. */
const PREVIEW_SECONDS = 30;

const clock = (seconds: number) => `0:${String(Math.round(seconds)).padStart(2, "0")}`;

/**
 * O disco que sai de trás da capa quando a prévia toca. É o único
 * objeto com giro aqui, e fica atrás: a arte nunca é coberta.
 */
function RecordBehind({ playing, reduced }: { playing: boolean; reduced: boolean }) {
  return (
    <div
      aria-hidden
      className="absolute left-[4%] top-[4%] aspect-square h-[92%] transition-transform duration-[600ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
      style={{ transform: `translateX(${playing ? 30 : 0}%)` }}
    >
      <span
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle at 50% 50%, #101317 0 17%, #08090b 17% 100%)",
          boxShadow: "0 18px 40px -18px rgb(0 0 0 / 0.95), inset 0 0 0 1px rgb(255 255 255 / 0.05)",
          animation: playing && !reduced ? "gy-spin 3.6s linear infinite" : undefined,
        }}
      >
        <span
          className="absolute inset-[5%] rounded-full"
          style={{
            background:
              "repeating-radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 3px)",
          }}
        />
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, rgb(255 255 255 / 0.07) 28deg, transparent 62deg, transparent 180deg, rgb(255 255 255 / 0.05) 212deg, transparent 250deg)",
          }}
        />
        <span
          className="absolute left-1/2 top-1/2 h-[32%] w-[32%] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "var(--chroma)" }}
        />
        <span className="absolute left-1/2 top-1/2 h-[3%] w-[3%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
      </span>
    </div>
  );
}

/** Uma tecla de decisão: ícone, o que ela faz e o atalho impresso. */
function DecisionKey({
  onClick,
  label,
  shortcut,
  ink = false,
  children,
}: {
  onClick: () => void;
  label: string;
  shortcut: string;
  ink?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-keyshortcuts={shortcut}
      className={`key h-auto flex-col justify-center gap-2 px-2 py-3.5 ${ink ? "key-ink" : ""}`}
    >
      {children}
      <span>{label}</span>
      <span className={`kbd ${ink ? "border-black/25 text-black/60" : ""}`}>{shortcut}</span>
    </button>
  );
}

export function DiscoveryStage({ queue, index, onAction }: StageProps) {
  const reduced = useReducedMotion() ?? false;
  const current = queue[index];
  const player = usePreviewPlayer(current?.previewUrl);

  // teclado: espaço toca, setas decidem — igual a qualquer player
  useEffect(() => {
    if (!current) return;

    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      // o pad usa as setas para mover a mira
      if (target?.getAttribute("role") === "group") return;
      // num botão focado o espaço já aciona o clique nativo; tocar de novo seria duplo
      if (target?.tagName === "BUTTON" && event.code === "Space") return;

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
      } else if (event.key.toLowerCase() === "k") {
        onAction(current, "known");
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

  const litSeconds = Math.round(player.progress * PREVIEW_SECONDS);

  return (
    <div className="flex w-full max-w-[440px] flex-col">
      <div className="relative w-full">
        {player.available && <RecordBehind playing={player.playing} reduced={reduced} />}

        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={current.id}
            className="relative"
            initial={reduced ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? undefined : { opacity: 0, x: -70, rotate: -3 }}
            transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
          >
            <button
              type="button"
              onClick={player.toggle}
              disabled={!player.available}
              aria-label={player.playing ? "Pausar prévia" : "Tocar prévia"}
              className="group relative block aspect-square w-full cursor-pointer border-0 bg-transparent p-0 shadow-lift disabled:cursor-default"
            >
              <ResilientCover
                src={current.coverUrl}
                alt={`Capa de ${current.albumName ?? current.trackName}`}
                label={current.albumName ?? current.artistName}
                priority
                className="h-full w-full"
              />

              {player.available && !player.playing && (
                <span className="absolute bottom-3 left-3 flex h-11 w-11 items-center justify-center border border-white/15 bg-background/85 text-text-primary transition-colors duration-150 group-hover:border-accent group-hover:text-accent">
                  <Play className="ml-0.5 h-4 w-4" />
                </span>
              )}

              {!player.available && (
                <span className="tag absolute bottom-3 left-3 bg-background/85 text-text-muted">sem prévia</span>
              )}
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* transporte: tocar, o tempo em segmentos e o relógio */}
      <div className="relative mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={player.toggle}
          disabled={!player.available}
          data-active={player.playing}
          aria-keyshortcuts="Space"
          className="key shrink-0"
        >
          {player.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          {player.playing ? "pausar" : "ouvir"}
          <span className="kbd">espaço</span>
        </button>

        <span className="meter h-2 flex-1" aria-hidden>
          {Array.from({ length: PREVIEW_SECONDS }, (_, second) => (
            <span key={second} data-lit={second < litSeconds} style={{ animation: "none" }} />
          ))}
        </span>

        <span className="data shrink-0 text-text-muted">
          {clock(player.progress * PREVIEW_SECONDS)} / {clock(PREVIEW_SECONDS)}
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current.id}
          className="mt-7"
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div className="flex flex-wrap items-center gap-2">
            {current.genre && <span className="tag text-text-primary">{formatGenre(current.genre)}</span>}
            {current.albumName && <span className="data truncate text-text-muted">{current.albumName}</span>}
          </div>

          <h2 className="display mt-4 text-[clamp(2rem,4vw,2.9rem)]">{current.artistName}</h2>
          <p className="mt-2 text-[15px] text-text-secondary">{current.trackName}</p>

          {current.reason && (
            <div className="mt-5 border border-border bg-well px-4 py-3">
              <span className="micro block">por que esta</span>
              <p className="data mt-1.5 text-[11px] leading-relaxed text-text-secondary">{current.reason}</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 grid grid-cols-4 gap-1.5">
        <DecisionKey onClick={() => decide("known")} label="conheço" shortcut="k">
          <Check className="h-4 w-4" />
        </DecisionKey>
        <DecisionKey onClick={() => decide("skipped")} label="pular" shortcut="→">
          <SkipForward className="h-4 w-4" />
        </DecisionKey>
        <DecisionKey onClick={() => decide("liked")} label="curti" shortcut="↑" ink>
          <ThumbsUp className="h-4 w-4" />
        </DecisionKey>
        <DecisionKey onClick={() => decide("saved")} label="guardar" shortcut="↓">
          <Bookmark className="h-4 w-4" />
        </DecisionKey>
      </div>
    </div>
  );
}
