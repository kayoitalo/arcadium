"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { sameGeometry } from "./measure";
import type { TraceGesture, TracePlan, WaveSpec } from "./trace";

/*
 * O traço de uma tela. Quem usa diz, a cada pose, o que o amigo desenha
 * (gestos, corda, anotações) a partir das medidas da tela; o hook cuida
 * do resto: esperar a cena assentar, redesenhar sem animar quando a tela
 * muda de tamanho ou a fonte chega, e lembrar o que já terminou de ser
 * desenhado — é isso que libera anotação e acende a linha citada.
 */

export interface PenNote {
  id: string;
  /** O gesto que, ao terminar, libera a anotação. */
  gesture: string;
  text: string;
  x: number;
  y: number;
  kind: "grito" | "dado";
  align?: "center" | "start" | "end";
  dim?: boolean;
  /** Mudou o número, a anotação grita de novo (o corte seco de uma transição). */
  pop?: number;
}

export interface PenDrawing {
  gestures: TraceGesture[];
  wave: WaveSpec | null;
  notes: PenNote[];
}

const EMPTY: PenDrawing = { gestures: [], wave: null, notes: [] };

export function usePen(
  stageRef: RefObject<HTMLElement | null>,
  draw: (origin: DOMRect) => PenDrawing | null,
  pose: string,
  { settle = 60, first = 380 }: { settle?: number; first?: number } = {},
) {
  const [plan, setPlan] = useState<TracePlan | null>(null);
  const [notes, setNotes] = useState<PenNote[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // só crescem: gesto que começou ou terminou uma vez fica marcado até alguém esquecer
  const [started, setStarted] = useState<Set<string>>(() => new Set());
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const planRef = useRef<TracePlan | null>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const poseRef = useRef(pose);
  poseRef.current = pose;

  const measure = useCallback(
    (instant: boolean) => {
      const stage = stageRef.current;
      if (!stage) return;
      const drawing = drawRef.current(stage.getBoundingClientRect()) ?? EMPTY;
      const candidate: TracePlan = { key: poseRef.current, gestures: drawing.gestures, wave: drawing.wave, instant };
      const previous = planRef.current;
      // remedida da mesma pose só vale se algo andou de lugar: senão atropelaria o gesto no meio
      if (instant && previous?.key === candidate.key && sameGeometry(previous, candidate)) return;
      planRef.current = candidate;
      setNotes(drawing.notes);
      setPlan(candidate);
    },
    [stageRef],
  );

  // a pose muda, a cena assenta, a medida manda o traço
  useEffect(() => {
    const timer = window.setTimeout(() => measure(false), planRef.current ? settle : first);
    return () => window.clearTimeout(timer);
  }, [pose, measure, settle, first]);

  // tela mudou de tamanho, ou a fonte chegou: mesma pose, medida nova, sem animar
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let timer = 0;
    const remeasure = () => {
      if (planRef.current) measure(true);
    };
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      window.clearTimeout(timer);
      timer = window.setTimeout(remeasure, 140);
    });
    observer.observe(stage);
    void document.fonts?.ready.then(remeasure);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [measure, stageRef]);

  const onGesture = useCallback((id: string, moment: "start" | "end") => {
    const add = (current: Set<string>) => (current.has(id) ? current : new Set(current).add(id));
    if (moment === "start") setStarted(add);
    else setDone(add);
  }, []);

  /** Esquece o que começou com este prefixo: o assunto riscado apaga a faixa e o que ela acendeu. */
  const forget = useCallback((prefix: string) => {
    const drop = (current: Set<string>) => new Set([...current].filter((id) => !id.startsWith(prefix)));
    setStarted(drop);
    setDone(drop);
  }, []);

  return {
    plan,
    size,
    notes: notes.filter((note) => done.has(note.gesture)),
    started,
    done,
    onGesture,
    measure,
    forget,
  };
}

export type Pen = ReturnType<typeof usePen>;
