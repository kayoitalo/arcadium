"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GrooveMarkCompact } from "@/components/brand/groove-mark";
import { useChroma } from "@/components/chroma/chroma-provider";
import { useChrome } from "@/components/layout/chrome";
import { SECTIONS, sectionFor } from "@/components/layout/sections";

/**
 * Duas faixas fixas: em cima o selo e a navegação; embaixo a barra de
 * contexto — nome da tela, período e o disco que está tingindo tudo.
 * O período mora aqui porque continua à mão depois de rolar a página.
 */
export function Masthead() {
  const pathname = usePathname();
  const current = sectionFor(pathname);
  const { title, periods, period, selectPeriod } = useChrome();
  const { tintLabel } = useChroma();

  return (
    <header className="sticky top-0 z-40 border-b border-rule/90 bg-background/[0.88] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1320px] items-center gap-7 px-5 py-3 sm:px-8">
        <Link
          href="/overview"
          className="flex shrink-0 items-center gap-2.5"
          aria-label="Grooveyard, ir para a visão geral"
        >
          <GrooveMarkCompact className="h-[22px] w-[22px] text-accent transition-colors duration-700" />
          <span
            className="text-[15px] tracking-tight"
            style={{ fontFamily: "var(--font-brand)", fontWeight: 700 }}
          >
            Grooveyard
          </span>
        </Link>

        <nav
          aria-label="Navegação principal"
          className="-mx-1 flex flex-1 items-stretch gap-5 overflow-x-auto px-1 sm:gap-6"
        >
          {SECTIONS.map((section) => {
            const active = section.href === current.href;
            return (
              <Link
                key={section.href}
                href={section.href}
                aria-current={active ? "page" : undefined}
                className={`relative shrink-0 py-2.5 text-[13px] transition-colors ${
                  active ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {section.label}
                <span
                  className="absolute inset-x-0 -bottom-px h-0.5 origin-left bg-accent transition-transform duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
                  style={{ transform: `scaleX(${active ? 1 : 0})` }}
                />
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="border-t border-rule/70 bg-background-secondary/70">
        <div className="mx-auto flex max-w-[1320px] items-center gap-4 px-5 py-2 sm:gap-5 sm:px-8">
          <span className="eyebrow shrink-0 text-text-primary">{title || current.label}</span>

          {periods.length > 0 && (
            <>
              <span className="hidden w-px self-stretch bg-rule sm:block" />
              <div className="flex shrink-0 gap-0.5">
                {periods.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    onClick={() => selectPeriod(entry.key)}
                    data-active={entry.key === period}
                    aria-pressed={entry.key === period}
                    className="tab"
                  >
                    {entry.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <span className="flex-1" />

          <div className="hidden shrink-0 items-center gap-2.5 sm:flex">
            <span className="eyebrow">tingido por</span>
            <span
              className="h-2.5 w-2.5 rounded-full bg-accent transition-colors duration-700"
              style={{ boxShadow: "0 0 12px -2px var(--chroma-glow)" }}
            />
            <span className="max-w-[22ch] truncate text-xs text-text-secondary">
              {tintLabel ?? "nenhum disco em foco"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
