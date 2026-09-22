"use client";

import { useRef } from "react";
import { motion, useAnimationFrame, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { Pause, Play, SkipForward } from "lucide-react";
import { ResilientCover } from "@/components/ui/resilient-cover";
import { AMBER, BANDS, CYAN, GREEN, MAGENTA, SCANLINES } from "@/components/arcadium/tokens";
import type { ArcadeAudio } from "@/components/audio/use-arcade-audio";
import type { AlbumItem } from "@/modules/statistics/application/overview-service";

/**
 * Fixa no canto, por cima de tudo: o disco continua no deck enquanto você
 * rola, troca de período ou muda de seção. É o fio que costura a tela —
 * antes "na agulha" era um ponto de 10px no topo.
 */
export function Jukebox({
  album,
  audio,
  onNext,
  line,
}: {
  album: AlbumItem | null;
  audio: ArcadeAudio;
  onNext: () => void;
  /** O que o modelo escreveu sobre este disco, quando existe. */
  line?: string;
}) {
  const reduced = useReducedMotion();
  const spin = useMotionValue(0);
  const glow = useTransform(audio.level, [0, 1], [0.08, 0.75]);
  const lift = useTransform(audio.bass, [0, 1], [1, 1.05]);

  useAnimationFrame((_, delta) => {
    if (reduced || !audio.playing) return;
    spin.set((spin.get() + (delta / 1000) * 96) % 360);
  });

  if (!album) return null;

  return (
    <motion.aside
      initial={{ y: 120, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 210, damping: 26 }}
      className="fixed bottom-5 right-5 z-40 w-[min(340px,calc(100vw-2.5rem))]"
    >
      <motion.div aria-hidden style={{ opacity: glow, scale: lift }} className="pointer-events-none absolute -inset-10">
        <div
          className="h-full w-full"
          style={{ background: "radial-gradient(closest-side, var(--chroma-glow), transparent 70%)" }}
        />
      </motion.div>

      {/* moldura do gabinete: dois fios, como bezel */}
      <div className="relative border border-border-strong p-[3px]">
        <div className="border border-rule bg-[#080a0c]" style={{ backgroundImage: SCANLINES }}>
          <div className="flex items-center gap-3 p-3">
            <div className="relative h-14 w-14 shrink-0">
              <ResilientCover
                src={album.coverUrl}
                alt={album.title}
                label={album.title}
                className="h-full w-full"
                caption={false}
                compact
              />
            </div>

            <motion.div
              aria-hidden
              style={reduced ? undefined : { rotate: spin }}
              className="relative h-12 w-12 shrink-0 rounded-full"
            >
              <div
                className="h-full w-full rounded-full"
                style={{ background: "radial-gradient(circle at 50% 50%, #14181d 0 30%, #0d1013 30% 100%)" }}
              />
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "repeating-radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.05) 0 1px, transparent 1px 4px)",
                }}
              />
              <div
                className="absolute left-1/2 top-1/2 h-[32%] w-[32%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ background: "var(--chroma)" }}
              />
            </motion.div>

            <div className="min-w-0 flex-1">
              <p className="font-mono text-[9px] uppercase tracking-[0.26em]" style={{ color: CYAN }}>
                na agulha
              </p>
              <p className="truncate font-mono text-[11px] text-text-secondary">
                {album.previewTrack ?? album.title}
              </p>
              <p className="truncate font-mono text-[10px] text-text-muted">{album.artistName}</p>
            </div>
          </div>

          <Spectrum bands={audio.bands} progress={audio.progress} />

          {line && (
            <p className="mt-3 border-t border-rule px-3 py-2 font-mono text-[10px] leading-relaxed text-text-muted">
              {line}
            </p>
          )}

          <div className="mt-1 flex items-center justify-between border-t border-rule px-3 py-2">
            <span
              className="font-mono text-[9px] uppercase tracking-[0.22em]"
              style={{ color: audio.failed ? "#e0604f" : audio.playing ? GREEN : "#79838c" }}
            >
              {audio.failed ? "sem prévia" : audio.playing ? "tocando" : "pausado"}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={audio.toggle}
                className="border border-rule p-2 text-text-secondary transition-transform hover:text-accent active:translate-y-[1px]"
                aria-label={audio.playing ? "pausar" : "tocar"}
              >
                {audio.playing ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <button
                type="button"
                onClick={onNext}
                className="border border-rule p-2 text-text-secondary transition-transform hover:text-accent active:translate-y-[1px]"
                aria-label="próximo disco"
              >
                <SkipForward size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

/**
 * O espectro real da prévia. Escreve direto no style de cada barra dentro
 * do quadro — passar 24 valores por estado do React a 60fps derrubaria a
 * página. Embaixo, um fio de 1px marca onde a faixa está.
 */
function Spectrum({ bands, progress }: { bands: React.RefObject<number[]>; progress: number }) {
  const reduced = useReducedMotion();
  const nodes = useRef<Array<HTMLSpanElement | null>>([]);

  useAnimationFrame(() => {
    if (reduced) return;
    const data = bands.current;
    for (let i = 0; i < BANDS; i += 1) {
      const node = nodes.current[i];
      if (!node) continue;
      const value = data[i] ?? 0;
      node.style.transform = `scaleY(${0.05 + value * 0.95})`;
      node.style.background = value > 0.78 ? MAGENTA : value > 0.4 ? AMBER : "rgb(255 176 0 / 0.42)";
    }
  });

  return (
    <div className="px-3">
      <div className="flex h-9 items-end gap-[2px]">
        {Array.from({ length: BANDS }).map((_, index) => (
          <span
            key={index}
            ref={(node) => {
              nodes.current[index] = node;
            }}
            className="h-full flex-1 origin-bottom"
            style={{ background: "rgb(255 176 0 / 0.42)", transform: "scaleY(0.05)" }}
          />
        ))}
      </div>
      <div className="mt-1 h-px w-full bg-rule">
        <div className="h-px" style={{ width: `${progress * 100}%`, background: CYAN }} />
      </div>
    </div>
  );
}
