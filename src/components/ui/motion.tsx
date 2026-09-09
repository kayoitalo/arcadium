"use client";

import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useSpring,
  type Variants,
} from "framer-motion";
import { useEffect, useRef, useState, type PropsWithChildren, type ReactNode } from "react";

export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
export const SPRING_SOFT = { type: "spring", stiffness: 180, damping: 26, mass: 0.9 } as const;
export const SPRING_SNAP = { type: "spring", stiffness: 420, damping: 34 } as const;

const container: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE_OUT_EXPO } },
};

export function MotionPage({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <motion.div className={className} variants={container} initial="hidden" animate="visible">{children}</motion.div>;
}

export function MotionSection({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <motion.section className={className} variants={item}>{children}</motion.section>;
}

export function MotionDiv({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <motion.div className={className} variants={item}>{children}</motion.div>;
}

/**
 * Linha de texto que sobe atrás de uma máscara. Usada nos títulos —
 * o texto já está no DOM, só a posição é animada.
 */
export function Reveal({ children, delay = 0, className = "" }: PropsWithChildren<{ delay?: number; className?: string }>) {
  const reduced = useReducedMotion();
  return (
    <span className={`block overflow-hidden ${className}`}>
      <motion.span
        className="block"
        initial={reduced ? false : { y: "105%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.9, ease: EASE_OUT_EXPO, delay }}
      >
        {children}
      </motion.span>
    </span>
  );
}

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

/**
 * Inclina o filho seguindo o ponteiro. Mola, não interpolação linear:
 * o movimento continua depois que o cursor para.
 */
export function Tilt({
  children,
  className = "",
  strength = 10,
  lift = 16,
}: PropsWithChildren<{ className?: string; strength?: number; lift?: number }>) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const rotateX = useSpring(useMotionValue(0), SPRING_SOFT);
  const rotateY = useSpring(useMotionValue(0), SPRING_SOFT);

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <div
      ref={ref}
      className={className}
      style={{ perspective: 1100 }}
      onPointerMove={(event) => {
        const bounds = ref.current?.getBoundingClientRect();
        if (!bounds) return;
        const x = (event.clientX - bounds.left) / bounds.width - 0.5;
        const y = (event.clientY - bounds.top) / bounds.height - 0.5;
        rotateY.set(x * strength);
        rotateX.set(-y * strength);
      }}
      onPointerLeave={() => {
        rotateX.set(0);
        rotateY.set(0);
      }}
    >
      <motion.div style={{ rotateX, rotateY, transformStyle: "preserve-3d", translateZ: lift }}>
        {children}
      </motion.div>
    </div>
  );
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
      initial={reduced ? false : { opacity: 0.35, y: 22 }}
      animate={inView || reduced ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.7, ease: EASE_OUT_EXPO, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Barra que cresce até a proporção informada. */
export function Bar({ ratio, className = "", delay = 0 }: { ratio: number; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return (
    <span className={`block h-px w-full bg-border ${className}`}>
      <motion.span
        className="block h-full bg-accent"
        initial={reduced ? false : { scaleX: 0 }}
        animate={{ scaleX: Math.max(0.02, Math.min(1, ratio)) }}
        transition={{ duration: 1, ease: EASE_OUT_EXPO, delay }}
        style={{ transformOrigin: "left center" }}
      />
    </span>
  );
}
