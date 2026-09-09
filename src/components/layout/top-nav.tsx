"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { GrooveMarkCompact } from "@/components/brand/groove-mark";

const NAV_ITEMS = [
  { href: "/overview", label: "Visão geral" },
  { href: "/taste-evolution", label: "Evolução" },
  { href: "/discovery", label: "Descobertas" },
  { href: "/history", label: "Histórico" },
  { href: "/settings", label: "Ajustes" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1320px] items-center gap-6 px-5 py-3.5 sm:px-8">
        <Link href="/overview" className="flex shrink-0 items-center gap-2.5" aria-label="Grooveyard, ir para a visão geral">
          <GrooveMarkCompact className="h-[22px] w-[22px] text-accent transition-colors duration-700" />
          <span
            className="text-[15px] tracking-tight"
            style={{ fontFamily: "var(--font-brand)", fontWeight: 700 }}
          >
            Grooveyard
          </span>
        </Link>

        <nav aria-label="Navegação principal" className="-mx-1 flex flex-1 items-center gap-1 overflow-x-auto px-1">
          {NAV_ITEMS.map((entry) => {
            const active = pathname === entry.href || pathname.startsWith(`${entry.href}/`);
            return (
              <Link
                key={entry.href}
                href={entry.href}
                aria-current={active ? "page" : undefined}
                className={`relative isolate shrink-0 rounded-full px-3 py-1.5 text-[12.5px] transition-colors ${
                  active ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 z-0 rounded-full bg-surface-elevated"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative z-10">{entry.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
