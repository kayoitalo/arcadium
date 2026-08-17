"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Compass, History, LayoutDashboard, Menu, Settings, TrendingUp, X } from "lucide-react";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/overview", label: "VISÃO GERAL", icon: LayoutDashboard },
  { href: "/taste-evolution", label: "EVOLUÇÃO DO GOSTO", icon: TrendingUp },
  { href: "/discovery", label: "DESCOBERTAS", icon: Compass },
  { href: "/history", label: "HISTÓRICO", icon: History },
  { href: "/settings", label: "CONFIGURAÇÕES", icon: Settings },
];

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return <><div className="flex items-center gap-3 px-2 pt-2"><div className="flex h-10 w-10 items-center justify-center rounded-xl border border-accent/40 bg-accent/15 shadow-glow"><span className="font-serif text-xl font-black tracking-tighter text-accent-gold">SP</span></div><div><h1 className="font-serif text-lg font-bold leading-none tracking-wider text-text-primary">SPOT</h1><p className="mt-0.5 font-mono text-[10px] tracking-[0.2em] text-text-muted">STATS</p></div></div>
    <nav className="mt-8 space-y-1" aria-label="Navegação principal">{navItems.map((entry) => { const Icon = entry.icon; const active = pathname === entry.href || pathname.startsWith(`${entry.href}/`); return <Link key={entry.href} href={entry.href} onClick={onNavigate} className={`group flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-semibold tracking-wider transition-all ${active ? "border border-accent/40 bg-accent/15 text-text-primary shadow-glow" : "text-text-secondary hover:bg-surface-elevated/70 hover:text-text-primary"}`}><span className="flex items-center gap-3"><Icon className={`h-4 w-4 ${active ? "text-accent-gold" : "text-text-muted group-hover:text-text-secondary"}`} />{entry.label}</span>{active && <motion.span layoutId="active-navigation" className="h-1.5 w-1.5 rounded-full bg-accent-gold shadow-[0_0_8px_#c59a60]" />}</Link>; })}</nav></>;
}

export function Sidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return <><button type="button" onClick={() => setOpen(true)} aria-label="Abrir menu" className="fixed left-4 top-4 z-40 rounded-xl border border-border bg-surface p-2.5 text-text-primary shadow-card md:hidden"><Menu className="h-5 w-5" /></button><aside className="sticky top-0 z-30 hidden h-screen min-h-screen w-64 shrink-0 select-none flex-col border-r border-border/80 bg-background-secondary p-5 md:flex"><Navigation /></aside><AnimatePresence>{open && <><motion.button aria-label="Fechar menu" className="fixed inset-0 z-40 bg-background/75 backdrop-blur-sm md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} /><motion.aside className="fixed inset-y-0 left-0 z-50 w-[min(20rem,88vw)] border-r border-border bg-background-secondary p-5 md:hidden" initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}><button type="button" onClick={() => setOpen(false)} aria-label="Fechar menu" className="absolute right-4 top-4 rounded-lg p-2 text-text-secondary hover:bg-surface"><X className="h-5 w-5" /></button><Navigation onNavigate={() => setOpen(false)} /></motion.aside></>}</AnimatePresence></>;
}
