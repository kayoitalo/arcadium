"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Fala, PenLayer, Respostas } from "./fala";
import { band, draft, DRAFT_LINES } from "./gestures";
import { boxOf, textLines } from "./measure";
import type { TraceGesture } from "./trace";
import { usePen, type PenDrawing } from "./use-pen";
import styles from "./amigo.module.css";

/** O tempo de uma linha do rascunho: dá pra caneta viajar, escrever e respirar. */
const DRAFT_BEAT_MS = 1300;

/**
 * Quando não há conversa — carregando, escrevendo, sem histórico, erro —
 * quem avisa é ele, com a mesma voz e o mesmo grifo. Nenhum spinner.
 *
 * Com `waiting`, a caneta não fica parada: rascunha linha por linha onde
 * o texto vai chegar, apaga e recomeça. Com movimento reduzido, o
 * rascunho fica inteiro e parado.
 */
export function Aviso({
  window: when,
  headline,
  narrative,
  compact = false,
  waiting = false,
  children,
}: {
  window?: ReactNode;
  headline: string;
  narrative?: string;
  /** No topo de uma tela de controles: a fala ocupa só o que precisa, e não é aviso de estado. */
  compact?: boolean;
  /** Ele está buscando ou escrevendo: a caneta rascunha enquanto isso. */
  waiting?: boolean;
  /** As respostas possíveis, logo abaixo da fala. */
  children?: ReactNode;
}) {
  const reduced = Boolean(useReducedMotion());
  const stageRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const draftRef = useRef<HTMLDivElement>(null);
  const silence = useRef<ArrayLike<number> | null>(null);
  // quantas linhas do rascunho já estão no papel: 0, 1, 2, 3 e de volta
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (!waiting || reduced) return;
    const timer = window.setInterval(() => setBeat((current) => (current + 1) % (DRAFT_LINES.length + 1)), DRAFT_BEAT_MS);
    return () => window.clearInterval(timer);
  }, [waiting, reduced]);
  const written = !waiting ? 0 : reduced ? DRAFT_LINES.length : beat;

  const draw = useCallback((origin: DOMRect): PenDrawing | null => {
    const mark = markRef.current;
    if (!mark) return null;
    const { lines, size } = textLines(mark, origin);
    if (lines.length === 0) return null;
    const { strokes, width } = band(lines, size);
    const gestures: TraceGesture[] = [{ id: "grifo", layer: "under", strokes, width, cap: "butt" }];
    const place = draftRef.current;
    if (place && written > 0) {
      gestures.push({ id: "rascunho", layer: "over", strokes: draft(boxOf(place, origin), written), width: 2, cap: "round" });
    }
    return { gestures, wave: null, notes: [] };
  }, [written]);
  const pen = usePen(stageRef, draw, `${headline}|${written}`, { first: 240 });

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
      {waiting && <div ref={draftRef} className={styles.draft} aria-hidden="true" />}
      {children && <Respostas inline>{children}</Respostas>}
      <PenLayer pen={pen} signal={silence} reduced={reduced} />
    </div>
  );
}
