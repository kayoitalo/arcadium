"use client";

import { useRef, type PropsWithChildren } from "react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";

/**
 * Revelação dirigida pelo scroll da própria seção: um corte que sobe, não
 * um fade genérico. É a diferença entre animar o layout — que todo site
 * faz igual — e animar alguma coisa.
 */
export function Reveal({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.95", "start 0.45"] });
  const clip = useTransform(scrollYProgress, [0, 1], [24, 0]);
  const clipPath = useTransform(clip, (value) => `inset(0% 0% ${value}% 0%)`);
  const y = useTransform(scrollYProgress, [0, 1], [30, 0]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [0.15, 1]);

  return (
    <motion.div ref={ref} className={className} style={reduced ? undefined : { clipPath, y, opacity }}>
      {children}
    </motion.div>
  );
}
