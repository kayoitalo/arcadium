"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * O pulso da música: um quadro lê o sinal uma vez e serve a capa (pela
 * variável --level no palco) e a corda do traço (pelo sinal devolvido).
 * Sem música, o nível volta a zero e a corda para.
 */
export function usePulse(
  stageRef: RefObject<HTMLElement | null>,
  playing: boolean,
  read: () => { signal: ArrayLike<number> | null; level: number },
) {
  const signal = useRef<ArrayLike<number> | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (!playing) {
      stage.style.setProperty("--level", "0");
      signal.current = null;
      return;
    }
    let frame = 0;
    const loop = () => {
      const now = read();
      signal.current = now.signal;
      stage.style.setProperty("--level", now.level.toFixed(3));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playing, read, stageRef]);

  return signal;
}
