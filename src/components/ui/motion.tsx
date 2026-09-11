"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type PropsWithChildren } from "react";

/** Curva dos objetos: disco, capa, braço. A interface usa 150ms seco no CSS. */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
export const SPRING_SOFT = { type: "spring", stiffness: 180, damping: 26, mass: 0.9 } as const;

/**
 * Número que transita de um valor ao outro em vez de trocar de corte.
 * Ao mudar de período, a diferença fica visível.
 */
export function CountUp({
  value,
  format = (input: number) => Math.round(input).toLocaleString("pt-BR"),
  className = "",
  duration = 1.1,
}: {
  value: number;
  format?: (input: number) => string;
  className?: string;
  duration?: number;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(0);

  useEffect(() => {
    if (reduced) {
      setShown(value);
      return;
    }

    const start = from.current;
    const startedAt = performance.now();
    const total = duration * 1000;
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / total);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = start + (value - start) * eased;
      from.current = current;
      setShown(current);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration, reduced]);

  return <span className={className}>{format(shown)}</span>;
}

/** Revela ao entrar na viewport, mas parte de um estado já legível. */
export function InViewFade({ children, className = "", delay = 0 }: PropsWithChildren<{ className?: string; delay?: number }>) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12% 0px" });
  const reduced = useReducedMotion();

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduced ? false : { opacity: 0.35, y: 12 }}
      animate={inView || reduced ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.5, ease: EASE_OUT_EXPO, delay }}
    >
      {children}
    </motion.div>
  );
}
