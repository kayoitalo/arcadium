"use client";

import { motion, useReducedMotion, useTransform } from "framer-motion";
import type { ArcadeAudio } from "@/components/audio/use-arcade-audio";

/**
 * O pulso atrás do que está tocando. Escala vem do grave, brilho do nível
 * — medidos no próprio áudio, não num loop decorativo. Parado, decai e
 * some: nada pisca à toa.
 */
export function Pulse({ audio, size = 820 }: { audio: ArcadeAudio; size?: number }) {
  const reduced = useReducedMotion();
  const scale = useTransform(audio.bass, [0, 1], [0.82, 1.28]);
  const opacity = useTransform(audio.level, [0, 1], [0.16, 0.92]);
  const ring = useTransform(audio.level, [0, 1], [0.04, 0.46]);

  if (reduced) return null;

  return (
    <>
      <motion.div
        aria-hidden
        style={{ scale, opacity, width: size, height: size }}
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        <div
          className="h-full w-full"
          style={{ background: "radial-gradient(closest-side, var(--chroma-glow), transparent 68%)" }}
        />
      </motion.div>
      <motion.div
        aria-hidden
        style={{ scale, opacity: ring, width: size * 0.68, height: size * 0.68 }}
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
      >
        <div className="h-full w-full rounded-full" style={{ border: "1px solid var(--chroma)" }} />
      </motion.div>
    </>
  );
}
