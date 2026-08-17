"use client";

import { motion, type Variants } from "framer-motion";
import type { PropsWithChildren } from "react";

const container: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] } },
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

