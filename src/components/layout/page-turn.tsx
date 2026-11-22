"use client";
import { motion, useReducedMotion } from "framer-motion";
import { GLIDE, TEMPO } from "@/lib/motion";
export function PageTurn({ children }: { children: React.ReactNode }) {
  const reduced = Boolean(useReducedMotion());
  // trocar de tela é só a página aparecendo: quem se mexe de verdade é a caneta
  return <motion.div initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: TEMPO.rapido, ease: GLIDE }}>{children}</motion.div>;
}
