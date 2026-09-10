"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GrooveMarkCompact } from "@/components/brand/groove-mark";
import { SECTIONS, sectionFor } from "@/components/layout/sections";

/**
 * O cabeçalho é o cabeçalho de uma ficha de arquivo, não uma barra de
 * navegação: em cima o selo e o carimbo de catálogo, embaixo as abas do
 * fichário — quadradas, marcadas por uma barra de tinta, na cor do disco
 * que estiver em foco.
 */
export function Masthead() {
  const pathname = usePathname();
  const current = sectionFor(pathname);

  return (
    <header className="glass-panel sticky top-0 z-40">
      <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-4 px-4 pb-2.5 pt-3 sm:px-7">
        <Link
          href="/overview"
          className="flex items-baseline gap-2.5"
          aria-label="Grooveyard, ir para a visão geral"
        >
          <GrooveMarkCompact className="h-[18px] w-[18px] shrink-0 self-center text-accent transition-colors duration-700" />
          <span className="wordmark text-[1.05rem] sm:text-[1.15rem]">Grooveyard</span>
          <span className="catalog hidden sm:inline">arquivo de escuta</span>
        </Link>

        <span className="catalog hidden items-center gap-3 md:flex">
          <span>GY–ARQ</span>
          <span className="h-2.5 w-px bg-border" />
          <span>33⅓ RPM</span>
          <span className="h-2.5 w-px bg-border" />
          <span className="text-accent">{current.code}</span>
        </span>
      </div>

      <nav aria-label="Navegação principal" className="border-t border-border">
        <ul className="mx-auto flex max-w-[1360px] list-none overflow-x-auto px-2 sm:px-5">
          {SECTIONS.map((section) => {
            const active = section.href === current.href;
            return (
              <li key={section.href} className="shrink-0">
                <Link
                  href={section.href}
                  className="tab flex items-baseline gap-1.5"
                  data-active={active}
                  aria-current={active ? "page" : undefined}
                >
                  <span className={active ? "text-accent" : "text-text-muted/70"}>{section.code}</span>
                  {section.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
