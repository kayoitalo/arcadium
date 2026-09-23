"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useChroma } from "@/components/chroma/chroma-provider";
import { useChrome } from "@/components/layout/chrome";
import { SECTIONS, sectionFor } from "@/components/layout/sections";
import { Key, Keys } from "@/components/ui/console";

/**
 * Duas faixas fixas. Em cima, o selo e a fileira de teclas das telas —
 * a tela atual fica com o LED aceso. Embaixo, a barra de contexto: nome
 * da tela, as teclas de período e o disco que está na agulha.
 */
export function Masthead() {
  const pathname = usePathname();
  const current = sectionFor(pathname);
  const { title, periods, period, selectPeriod } = useChrome();
  const { tintLabel } = useChroma();
  const navRef = useRef<HTMLElement>(null);

  // no celular a fileira rola: a tecla acesa precisa estar à vista
  useEffect(() => {
    navRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current.href]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex max-w-[1320px] items-center gap-6 px-5 py-2.5 sm:px-8">
        <Link
          href="/overview"
          className="shrink-0 text-[15px] tracking-tight"
          style={{ fontFamily: "var(--font-brand)", fontWeight: 700 }}
          aria-label="Arcadium, ir para a visão geral"
        >
          Arcadium
        </Link>

        <nav ref={navRef} aria-label="Navegação principal" className="keys ml-auto min-w-0 overflow-x-auto">
          {SECTIONS.map((section) => {
            const active = section.href === current.href;
            return (
              <Link
                key={section.href}
                href={section.href}
                aria-current={active ? "page" : undefined}
                className="key shrink-0"
              >
                <span className="led" aria-hidden />
                {section.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-rule bg-background-secondary">
        <div className="mx-auto flex h-11 max-w-[1320px] items-center gap-4 px-5 sm:gap-5 sm:px-8">
          {/* no celular a tecla acesa lá em cima já diz onde você está */}
          <span className="eyebrow hidden shrink-0 text-text-primary sm:inline">{title || current.label}</span>

          {periods.length > 0 && (
            <Keys label="Período" className="min-w-0 overflow-x-auto">
              {periods.map((entry) => (
                <Key
                  key={entry.key}
                  size="sm"
                  className="shrink-0"
                  active={entry.key === period}
                  aria-pressed={entry.key === period}
                  onClick={() => selectPeriod(entry.key)}
                >
                  {entry.label}
                </Key>
              ))}
            </Keys>
          )}

          <span className="flex-1" />

          {tintLabel && (
            <div className="hidden min-w-0 items-center gap-2.5 md:flex">
              <span className="eyebrow shrink-0">na agulha</span>
              <span className="h-2.5 w-2.5 shrink-0 bg-chroma" />
              <span className="max-w-[26ch] truncate text-xs text-text-secondary">{tintLabel}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
