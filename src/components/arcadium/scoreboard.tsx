"use client";

import { CountUp } from "@/components/ui/motion";
import { SCANLINES } from "@/components/arcadium/tokens";
import type { ReactNode } from "react";

export interface ScoreEntry {
  /** 1up, 2up, hi… a etiqueta do gabinete, só decorativa de posição. */
  tag: string;
  label: string;
  value: number;
  tint: string;
  format?: (value: number) => string;
  /** Quanto da escuta aquele número concentra, 0..1. */
  ratio?: number;
  note?: string;
  detail?: string;
  footer?: ReactNode;
  approximate?: boolean;
}

/**
 * Os mesmos números de sempre, lidos como placar: moldura dupla, vidro de
 * tubo e zero à esquerda. Nada de dado se perde — as notas, a cobertura e
 * a variação continuam embaixo, porque um número sem contexto aqui é
 * enfeite, e enfeite é proibido em dado.
 */
export function Scoreboard({ entries, aside }: { entries: ScoreEntry[]; aside?: ReactNode }) {
  return (
    <section>
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <p className="eyebrow text-accent">high score</p>
        {aside}
      </div>

      <div className="border border-border-strong p-[3px]">
        <div className="grid gap-px bg-rule sm:grid-cols-2 xl:grid-cols-4">
          {entries.map((entry) => (
            <div key={entry.label} className="relative bg-[#080a0c] px-5 py-6">
              <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: SCANLINES }} aria-hidden />
              <div className="relative">
                <div className="flex items-baseline justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-text-muted">{entry.label}</p>
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: entry.tint }}>
                    {entry.tag}
                  </p>
                </div>

                <strong className="display mt-3 block text-[clamp(2rem,4.4vw,3.2rem)] leading-none tabular-nums">
                  {entry.approximate && <span className="mr-1 align-middle text-[0.4em] text-text-muted">≈</span>}
                  <CountUp
                    value={entry.value}
                    format={
                      entry.format ??
                      ((input) => Math.round(input).toLocaleString("pt-BR").padStart(6, "0"))
                    }
                  />
                </strong>

                {typeof entry.ratio === "number" && (
                  <div className="mt-4 flex gap-[2px]" aria-hidden>
                    {Array.from({ length: 28 }).map((_, index) => (
                      <span
                        key={index}
                        className="h-1.5 flex-1"
                        style={{
                          background:
                            index < Math.round(entry.ratio! * 28) ? entry.tint : "rgb(255 255 255 / 0.06)",
                        }}
                      />
                    ))}
                  </div>
                )}

                {entry.note && <p className="mt-3 font-mono text-[11px] text-text-muted">{entry.note}</p>}
                {entry.detail && <p className="mt-1 font-mono text-[10px] text-text-label">{entry.detail}</p>}
                {entry.footer && <div className="mt-1.5">{entry.footer}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
