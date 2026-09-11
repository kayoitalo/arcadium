"use client";

import { useEffect, useRef, useState } from "react";

export interface PadDot {
  id: string;
  /** 0..100, longe → perto */
  proximity: number;
  /** 0..100, obscuro → famoso */
  fame: number;
  done: boolean;
  current: boolean;
}

interface XYPadProps {
  proximity: number;
  fame: number;
  dots: PadDot[];
  busy: boolean;
  /** Durante o arrasto: só move a mira. */
  onChange: (proximity: number, fame: number) => void;
  /** Ao soltar (ou parar nas setas): busca com esse ponto. */
  onCommit: (proximity: number, fame: number) => void;
}

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

export const zoneOf = (value: number, low: string, high: string) =>
  value < 35 ? low : value > 70 ? high : "meio";

/**
 * O XY pad: um quadrado só controla os dois eixos. Arrastar move a mira
 * sem atraso; soltar dispara a busca. As setas andam de 5 em 5 (Shift
 * anda 10) e a busca sai quando você para de apertar.
 */
export function XYPad({ proximity, fame, dots, busy, onChange, onCommit }: XYPadProps) {
  const surface = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const keyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (keyTimer.current) clearTimeout(keyTimer.current);
  }, []);

  const read = (event: React.PointerEvent) => {
    const bounds = surface.current?.getBoundingClientRect();
    if (!bounds) return null;
    return {
      proximity: clamp(((event.clientX - bounds.left) / bounds.width) * 100),
      fame: clamp(100 - ((event.clientY - bounds.top) / bounds.height) * 100),
    };
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const step = event.shiftKey ? 10 : 5;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[event.key];
    if (!move) return;

    // as setas do pad não podem virar "curti/guardar" da tela
    event.preventDefault();
    event.stopPropagation();
    const next = { proximity: clamp(proximity + move[0]), fame: clamp(fame + move[1]) };
    onChange(next.proximity, next.fame);

    if (keyTimer.current) clearTimeout(keyTimer.current);
    keyTimer.current = setTimeout(() => onCommit(next.proximity, next.fame), 450);
  };

  return (
    <div className="border border-border bg-well">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-3 py-2">
        <span className="eyebrow">xy · o mapa</span>
        <span className="data flex items-center gap-2 text-text-muted">
          <span
            className="led"
            data-on={busy}
            style={busy ? { animation: "gy-blink 0.7s steps(1) infinite" } : undefined}
            aria-hidden
          />
          {busy ? "buscando" : `${dots.length} no mapa`}
        </span>
      </div>

      <div className="p-3">
        <div
          ref={surface}
          role="group"
          tabIndex={0}
          aria-label={`Mapa de descoberta. Proximidade ${proximity}, fama ${fame}. Setas mudam o ponto.`}
          onKeyDown={onKeyDown}
          onPointerDown={(event) => {
            const point = read(event);
            if (!point) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            setDragging(true);
            onChange(point.proximity, point.fame);
          }}
          onPointerMove={(event) => {
            if (!dragging) return;
            const point = read(event);
            if (point) onChange(point.proximity, point.fame);
          }}
          onPointerUp={(event) => {
            if (!dragging) return;
            setDragging(false);
            const point = read(event);
            if (point) onCommit(point.proximity, point.fame);
          }}
          className="relative aspect-square w-full cursor-crosshair touch-none select-none border border-rule"
          style={{
            background:
              "repeating-linear-gradient(90deg, #12161a 0 1px, transparent 1px 12.5%), repeating-linear-gradient(0deg, #12161a 0 1px, transparent 1px 12.5%)",
          }}
        >
          <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
          <span className="absolute inset-y-0 left-1/2 w-px bg-border" />

          {/* mira: as duas linhas passam pelo ponto escolhido */}
          <span
            className="pointer-events-none absolute inset-y-0 w-px"
            style={{
              left: `${proximity}%`,
              background: "var(--machine-line)",
              transition: dragging ? "none" : "left 150ms var(--ease-out-expo)",
            }}
          />
          <span
            className="pointer-events-none absolute inset-x-0 h-px"
            style={{
              top: `${100 - fame}%`,
              background: "var(--machine-line)",
              transition: dragging ? "none" : "top 150ms var(--ease-out-expo)",
            }}
          />

          {dots.map((dot) => (
            <span
              key={dot.id}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${dot.proximity}%`,
                top: `${100 - dot.fame}%`,
                width: dot.current ? 8 : 5,
                height: dot.current ? 8 : 5,
                background: dot.current ? "var(--chroma)" : dot.done ? "#2a3038" : "#8b959e",
              }}
            />
          ))}

          <span
            className="pointer-events-none absolute flex h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center border border-accent"
            style={{
              left: `${proximity}%`,
              top: `${100 - fame}%`,
              transition: dragging ? "none" : "left 150ms var(--ease-out-expo), top 150ms var(--ease-out-expo)",
            }}
          >
            <span className="h-1.5 w-1.5 bg-accent" style={{ boxShadow: "0 0 8px rgb(255 176 0 / 0.8)" }} />
          </span>

          <span className="micro pointer-events-none absolute left-2 top-1.5">famoso</span>
          <span className="micro pointer-events-none absolute bottom-1.5 left-2">obscuro</span>
        </div>

        <div className="mt-2 flex justify-between">
          <span className="micro">longe</span>
          <span className="micro">proximidade</span>
          <span className="micro">perto</span>
        </div>
      </div>

      <div className="ruled grid-cols-2 border-t border-rule">
        <div className="bg-well px-3 py-2.5">
          <span className="micro block">proximidade</span>
          <span className="data mt-1 block text-text-primary">
            {proximity} <span className="text-text-muted">· {zoneOf(proximity, "longe", "perto")}</span>
          </span>
        </div>
        <div className="bg-well px-3 py-2.5">
          <span className="micro block">fama</span>
          <span className="data mt-1 block text-text-primary">
            {fame} <span className="text-text-muted">· {zoneOf(fame, "obscuro", "famoso")}</span>
          </span>
        </div>
      </div>
    </div>
  );
}
