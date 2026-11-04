"use client";
import { motion, useReducedMotion } from "framer-motion";
export function PageTurn({ children }: { children: React.ReactNode }) {
  const reduced = Boolean(useReducedMotion());
  return <motion.div initial={reduced ? false : { y: 6 }} animate={{ y: 0 }} transition={{ duration: .18, ease: "easeOut" }}>{children}</motion.div>;
}
