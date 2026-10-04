"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useRef, type ReactNode } from "react";
import { Fala, PenLayer, Respostas } from "./fala";
import { band } from "./gestures";
import { textLines } from "./measure";
import { usePen, type PenDrawing } from "./use-pen";
import styles from "./amigo.module.css";

/**
 * Quando não há conversa — carregando, escrevendo, sem histórico, erro —
 * quem avisa é ele, com a mesma voz e o mesmo grifo. Nenhum spinner.
 */
export function Aviso({
  window: when,
  headline,
  narrative,
  compact = false,
  children,
}: {
  window?: ReactNode;
  headline: string;
  narrative?: string;
  /** No topo de uma tela de controles: a fala ocupa só o que precisa, e não é aviso de estado. */
  compact?: boolean;
  /** As respostas possíveis, logo abaixo da fala. */
  children?: ReactNode;
}) {
  const reduced = Boolean(useReducedMotion());
  const stageRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const silence = useRef<ArrayLike<number> | null>(null);

  const draw = useCallback((origin: DOMRect): PenDrawing | null => {
    const mark = markRef.current;
    if (!mark) return null;
    const { lines, size } = textLines(mark, origin);
    if (lines.length === 0) return null;
    const { strokes, width } = band(lines, size);
    return { gestures: [{ id: "grifo", layer: "under", strokes, width, cap: "butt" }], wave: null, notes: [] };
  }, []);
  const pen = usePen(stageRef, draw, headline, { first: 240 });

  return (
    <div
      ref={stageRef}
      className={styles.aviso}
      data-compact={compact || undefined}
      role={compact ? undefined : "status"}
    >
      <Fala
        level={1}
        window={when}
        headline={headline}
        narrative={narrative}
        markRef={markRef}
        marked={pen.started.has("grifo")}
      />
      {children && <Respostas inline>{children}</Respostas>}
      <PenLayer pen={pen} signal={silence} reduced={reduced} />
    </div>
  );
}
