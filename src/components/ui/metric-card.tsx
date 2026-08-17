"use client";

import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import { motion } from "framer-motion";

export function MetricCard({ icon: Icon, label, value, change, detail }: { icon: LucideIcon; label: string; value: string; change?: number | null; detail: string }) {
  const changeText = change == null ? "Sem período comparável" : `${change > 0 ? "+" : ""}${change}% vs. período anterior`;
  return <motion.article layout whileHover={{ y: -3 }} transition={{ duration: 0.2 }} className="rounded-2xl border border-border/60 bg-surface/35 p-4 transition-colors hover:border-accent/40 sm:p-5">
    <div className="flex items-center justify-between text-text-muted">
      <span className="flex items-center gap-2 text-[10px] font-mono font-bold tracking-wider"><Icon className="h-4 w-4 text-accent-gold" />{label}</span>
      <span title={detail}><Info className="h-3.5 w-3.5" /></span>
    </div>
    <strong className="mt-3 block font-serif text-3xl text-text-primary sm:text-4xl">{value}</strong>
    <span className={`mt-2 block text-[11px] font-mono ${change == null ? "text-text-muted" : change >= 0 ? "text-status-success" : "text-status-error"}`}>{changeText}</span>
  </motion.article>;
}
