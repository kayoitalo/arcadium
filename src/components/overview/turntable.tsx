"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { ArrowUpRight, Pause, Play } from "lucide-react";
import { findAlbumLine } from "@/components/ai/album-line";
import type { PreviewPlayer } from "@/components/audio/use-preview-player";
import { ResilientCover } from "@/components/ui/resilient-cover";
import { EASE_OUT_EXPO, SPRING_SOFT } from "@/components/ui/motion";
import { Voice } from "@/components/ui/voice";
import type { AlbumItem } from "@/modules/statistics/application/overview-service";
import type { AlbumLine } from "@/modules/ai-analysis/domain/ai-analysis.types";

interface TurntableProps {
  albums: AlbumItem[];
  selectedIndex: number;
  /** O player da tela: a vitrola toca a prévia do disco que está na agulha. */
  player: PreviewPlayer;
  /** Comentários do pacote; o disco na agulha mostra o seu, quando existe. */
  albumLines?: AlbumLine[];
}

/** Medidas em que a vitrola foi desenhada; abaixo disso ela encolhe inteira. */
const STAGE_WIDTH = 470;
const STAGE_HEIGHT = 400;

/**
 * Ângulo do braço em torno do pivô: em repouso ele fica fora do disco,
 * no alto; tocando, desce e a agulha pousa no sulco de fora — e caminha
 * para dentro conforme a prévia corre, como num disco de verdade.
 */
const ARM_REST_DEG = 42;
const ARM_PLAYING_DEG = 24;
const ARM_END_DEG = 15;

/**
 * Onde a agulha está. O braço só volta ao descanso quando não há prévia
 * em curso: pausado no meio ele fica onde parou, pelo mesmo motivo que o
 * disco mantém o ângulo em que estava em vez de saltar.
 */
export function armAngle(progress: number, playing: boolean): number {
  const onRecord = progress > 0 && progress < 1;
  if (!playing && !onRecord) return ARM_REST_DEG;
  const travelled = Math.min(1, Math.max(0, progress));
  return ARM_PLAYING_DEG + (ARM_END_DEG - ARM_PLAYING_DEG) * travelled;
}

/** As prévias do catálogo têm 30 segundos: um segmento por segundo. */
const PREVIEW_SECONDS = 30;

/**
 * A vitrola. O disco em foco está no prato, com a capa servindo de
 * bolacha central e a mesma capa embaixo, como encarte. Clicar no prato
 * toca a prévia da faixa mais ouvida do disco: o braço desce e o disco
 * acelera. Escolher outro disco é no caixote, logo abaixo.
 */
export function Turntable({ albums, selectedIndex, player, albumLines = [] }: TurntableProps) {
  const reduced = useReducedMotion();
  // ref de estado, não useRef: o palco só existe depois que os discos
  // chegam, e um useRef não avisaria o observer de que ele nasceu
  const [stage, setStage] = useState<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  // o prato tem geometria fixa (braço, fuso, sulcos): em vez de recalcular
  // tudo em porcentagem, a cena inteira encolhe junto com a coluna
  useEffect(() => {
    if (!stage) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / STAGE_WIDTH));
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stage]);

  const pointerX = useSpring(useMotionValue(0), SPRING_SOFT);
  const pointerY = useSpring(useMotionValue(0), SPRING_SOFT);
  const rotateY = useTransform(pointerX, (value) => value * 9);
  const rotateX = useTransform(pointerY, (value) => -value * 9);

  if (albums.length === 0) return null;

  const current = albums[selectedIndex] ?? albums[0];
  const playable = Boolean(current.previewUrl);
  const playing = playable && player.playing;
  const litSeconds = Math.round(player.progress * PREVIEW_SECONDS);
  const comment = findAlbumLine(albumLines, current);

  return (
    <div className="relative mx-auto w-full max-w-[470px]">
      <div
        ref={setStage}
        className={`relative w-full ${playable ? "cursor-pointer" : ""}`}
        style={{ perspective: 1200, height: STAGE_HEIGHT * scale }}
        role={playable ? "button" : undefined}
        tabIndex={playable ? 0 : undefined}
        aria-label={playable ? `${playing ? "Pausar" : "Tocar"} a prévia de ${current.previewTrack}` : undefined}
        aria-pressed={playable ? playing : undefined}
        onClick={() => playable && player.toggle()}
        onKeyDown={(event) => {
          if (!playable || (event.key !== "Enter" && event.key !== " ")) return;
          event.preventDefault();
          player.toggle();
        }}
        onPointerMove={(event) => {
          if (reduced) return;
          const bounds = stage?.getBoundingClientRect();
          if (!bounds) return;
          pointerX.set((event.clientX - bounds.left) / bounds.width - 0.5);
          pointerY.set((event.clientY - bounds.top) / bounds.height - 0.5);
        }}
        onPointerLeave={() => {
          pointerX.set(0);
          pointerY.set(0);
        }}
      >
        <motion.div
          className="absolute left-1/2 top-0 h-[400px] w-[470px]"
          style={{
            rotateX,
            rotateY,
            transformStyle: "preserve-3d",
            x: "-50%",
            scale,
            originY: 0,
          }}
        >
          {/* encarte: a capa inteira, atrás e fora de foco, saindo pela
              esquerda do prato. O transform fica no invólucro porque o
              framer reescreve o transform do elemento que ele anima. */}
          <div
            className="absolute left-1/2 top-[66px] h-[236px] w-[236px]"
            style={{ transform: "translateX(-50%) translate(-96px, 0) rotate(-6deg)" }}
          >
            <motion.div
              key={`sleeve-${current.id ?? current.title}`}
              className="h-full w-full overflow-hidden rounded-sm"
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 0.5 }}
              transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
            >
              <ResilientCover
                src={current.coverUrl}
                alt=""
                label={current.title}
                compact
                className="h-full w-full"
                imageClassName="blur-[1.5px] brightness-[0.62]"
              />
            </motion.div>
          </div>

          {/* prato */}
          <div
            className="absolute left-1/2 top-[39px] h-[322px] w-[322px] -translate-x-1/2 rounded-full"
            style={{
              background: "radial-gradient(circle at 50% 50%, #14181d 0 44%, #0f1216 44% 100%)",
              boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.05), 0 30px 56px -26px rgb(0 0 0 / 0.92)",
            }}
          >
            <div
              className="absolute inset-2 rounded-full"
              style={{
                background:
                  "repeating-radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.022) 0 1px, transparent 1px 5px)",
              }}
            />
            <div
              className="pointer-events-none absolute -inset-7 -z-10 rounded-full"
              style={{
                background: "radial-gradient(closest-side, var(--chroma-glow), transparent 72%)",
                animation: "gy-pulse 5.5s ease-in-out infinite",
              }}
            />
          </div>

          {/* bolacha: gira devagar em exposição; tocando, a camada de dentro
              acelera. Pausar a camada em vez de removê-la evita o disco
              saltar de ângulo quando a prévia para. */}
          <div
            className="absolute left-1/2 top-[50px] h-[300px] w-[300px] -translate-x-1/2 rounded-full"
            style={{
              background: "radial-gradient(circle at 50% 50%, #101317 0 17%, #08090b 17% 100%)",
              boxShadow: "0 14px 34px -16px rgb(0 0 0 / 0.9), inset 0 0 0 1px rgb(255 255 255 / 0.04)",
              animation: reduced ? undefined : "gy-spin 26s linear infinite",
            }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                animation: reduced ? undefined : "gy-spin 1.8s linear infinite",
                animationPlayState: playing ? "running" : "paused",
              }}
            >
              <div
                className="absolute inset-[7px] rounded-full"
                style={{
                  background:
                    "repeating-radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 3px)",
                }}
              />
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "conic-gradient(from 0deg, transparent 0deg, rgb(255 255 255 / 0.07) 28deg, transparent 62deg, transparent 180deg, rgb(255 255 255 / 0.05) 212deg, transparent 250deg)",
                }}
              />

              {/* o rótulo é a própria capa, recortada em círculo */}
              <div className="absolute left-1/2 top-1/2 h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full shadow-[0_2px_12px_rgb(0_0_0/0.55)]">
                <ResilientCover
                  src={current.coverUrl}
                  alt={`Capa de ${current.title}`}
                  label={current.title}
                  priority
                  className="h-full w-full"
                />
                <span className="absolute inset-[14%] rounded-full border border-black/20" />
              </div>
              <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
            </div>
          </div>

          {/* braço */}
          <div
            className="absolute right-1.5 top-[197px] h-1.5 w-[274px] origin-right transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: `rotate(${armAngle(player.progress, playing)}deg)` }}
          >
            <span
              className="absolute -right-[11px] -top-[11px] h-7 w-7 rounded-full"
              style={{
                background: "linear-gradient(150deg, #3b444e, #1d2329)",
                boxShadow: "0 3px 10px rgb(0 0 0 / 0.65)",
              }}
            />
            <span
              className="absolute left-[18px] right-3 top-0.5 h-[2.5px] rounded-sm"
              style={{ background: "linear-gradient(90deg, #6f7b86, #39424c)" }}
            />
            <span
              className="absolute left-0 -top-[3px] h-3 w-[22px] rounded-sm"
              style={{ background: "linear-gradient(150deg, #545f6a, #262d35)" }}
            >
              <span className="absolute bottom-[-5px] left-0.5 h-1.5 w-0.5 bg-accent" />
            </span>
          </div>
        </motion.div>
      </div>

      {/* o que está tocando, lido como no display do aparelho */}
      <div className="mt-4 border-y border-rule py-3">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <span className="eyebrow">na agulha</span>
            <p className="mt-1.5 truncate text-sm font-semibold text-text-primary">{current.title}</p>
            <p className="truncate text-xs text-text-muted">{current.artistName}</p>
          </div>
          <span className="data shrink-0 text-text-label">
            <b className="text-[13px] font-semibold text-text-primary">{current.plays.toLocaleString("pt-BR")}</b>{" "}
            audições
          </span>
        </div>

        {playable && (
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={player.toggle}
              data-active={playing}
              aria-label={playing ? "Pausar a prévia" : `Tocar a prévia de ${current.previewTrack}`}
              className="key key-sm shrink-0"
            >
              {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {playing ? "pausar" : "ouvir"}
            </button>

            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="data truncate text-text-secondary">{current.previewTrack}</span>
              <span className="meter h-1.5" aria-hidden>
                {Array.from({ length: PREVIEW_SECONDS }, (_, second) => (
                  <span key={second} data-lit={playing && second < litSeconds} style={{ animation: "none" }} />
                ))}
              </span>
            </span>

            {current.appleMusicUrl && (
              <a
                href={current.appleMusicUrl}
                target="_blank"
                rel="noreferrer"
                className="data inline-flex shrink-0 items-center gap-1 text-text-label transition-colors duration-150 hover:text-text-primary"
              >
                apple music
                <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* o que o Gemini achou do disco que está tocando; sem frase pra ele,
          o display fica só com os dados, sem inventar comentário */}
      {comment && (
        <Voice label="sobre o disco" screen className="mt-4">
          {comment.line}
        </Voice>
      )}

    </div>
  );
}
