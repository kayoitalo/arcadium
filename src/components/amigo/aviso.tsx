"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Fala, PenLayer, Respostas } from "./fala";
import { band, circle, draft, DRAFT_LINES, frame } from "./gestures";
import { boxOf, textLines } from "./measure";
import type { TraceGesture } from "./trace";
import { usePen, type PenDrawing } from "./use-pen";
import styles from "./amigo.module.css";

/** O tempo de uma linha do rascunho: dá pra caneta viajar, escrever e respirar. */
const DRAFT_BEAT_MS = 1300;
/** Quanto ele espera antes de dizer, com dado, que ainda está lendo. */
const LATER_MS = 5000;

/**
 * A planta da tela que vem: as peças que a caneta desenha, em ordem, no
 * lugar onde o conteúdo vai cair. "linha" é texto, "capa" é a moldura da
 * arte, "barra" é a régua de um dado.
 */
export type Planta = "conversa" | "retrato" | "ano" | "historico" | "mudou" | "descobrir";
type Peca = { kind: "linha" | "capa" | "barra" | "grade"; share?: number };
const PLANTAS: Record<Planta, { fala: Peca[]; prova: Peca[] }> = {
  conversa: { fala: [{ kind: "linha", share: 1 }, { kind: "linha", share: 0.92 }, { kind: "linha", share: 0.6 }], prova: [{ kind: "capa" }, { kind: "barra", share: 1 }, { kind: "barra", share: 0.7 }, { kind: "barra", share: 0.45 }] },
  retrato: { fala: [{ kind: "linha", share: 0.5 }, { kind: "linha", share: 0.8 }], prova: [{ kind: "capa" }, { kind: "barra", share: 0.4 }, { kind: "barra", share: 0.4 }] },
  ano: { fala: [{ kind: "linha", share: 1 }, { kind: "linha", share: 0.7 }], prova: [{ kind: "capa" }] },
  historico: { fala: [{ kind: "linha", share: 0.9 }, { kind: "linha", share: 0.55 }], prova: [{ kind: "grade" }] },
  mudou: { fala: [{ kind: "linha", share: 1 }, { kind: "linha", share: 0.66 }], prova: [{ kind: "barra", share: 1 }, { kind: "barra", share: 0.82 }, { kind: "barra", share: 0.6 }, { kind: "barra", share: 0.4 }] },
  descobrir: { fala: [{ kind: "linha", share: 1 }, { kind: "linha", share: 0.74 }], prova: [{ kind: "capa" }, { kind: "barra", share: 0.9 }] },
};

/** Uma capa que tocou há pouco: a fita que ele folheia enquanto lê. */
export interface Folha {
  key: string;
  coverUrl: string;
  caption: string;
}

/**
 * Quando não há conversa — carregando, escrevendo, sem histórico, erro —
 * quem avisa é ele, com a mesma voz e o mesmo grifo. Nenhum spinner.
 *
 * Com `waiting`, a caneta não fica parada. Sem `planta`, rascunha linha por
 * linha onde o texto vai chegar, apaga e recomeça. Com `planta`, desenha a
 * planta da tela que vem — moldura da capa, réguas, linhas — e deixa ela no
 * papel até o conteúdo cair no mesmo lugar. Com `fita`, folheia as últimas
 * capas que tocaram, circulando uma de cada vez. `later` é o que ele diz se
 * a espera passar de cinco segundos. Com movimento reduzido, tudo fica
 * inteiro e parado.
 */
export function Aviso({
  window: when,
  headline,
  narrative,
  compact = false,
  waiting = false,
  planta,
  fita,
  later,
  children,
}: {
  window?: ReactNode;
  headline: string;
  narrative?: string;
  /** No topo de uma tela de controles: a fala ocupa só o que precisa, e não é aviso de estado. */
  compact?: boolean;
  /** Ele está buscando ou escrevendo: a caneta rascunha enquanto isso. */
  waiting?: boolean;
  /** A planta da tela que vem, desenhada no lugar dela. */
  planta?: Planta;
  /** As últimas capas que tocaram: ele folheia enquanto espera. */
  fita?: Folha[];
  /** O que ele diz, com dado, se a espera passar de cinco segundos. */
  later?: string;
  /** As respostas possíveis, logo abaixo da fala. */
  children?: ReactNode;
}) {
  const reduced = Boolean(useReducedMotion());
  const stageRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const draftRef = useRef<HTMLDivElement>(null);
  const plantaRef = useRef<HTMLDivElement>(null);
  const fitaRef = useRef<HTMLDivElement>(null);
  const silence = useRef<ArrayLike<number> | null>(null);
  const pieces = planta ? [...PLANTAS[planta].prova, ...PLANTAS[planta].fala] : [];
  const loop = planta ? pieces.length : DRAFT_LINES.length + 1;
  // o relógio da espera: linhas do rascunho, peças da planta, capa folheada
  const [beat, setBeat] = useState(0);
  useEffect(() => {
    if (!waiting || reduced) return;
    const timer = window.setInterval(() => setBeat((current) => current + 1), DRAFT_BEAT_MS);
    return () => window.clearInterval(timer);
  }, [waiting, reduced]);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!waiting || !later) return;
    const timer = window.setTimeout(() => setSlow(true), reduced ? 0 : LATER_MS);
    return () => window.clearTimeout(timer);
  }, [waiting, later, reduced]);

  const written = !waiting ? 0 : reduced ? loop : planta ? Math.min(loop, beat + 1) : beat % loop;
  const leaf = fita && fita.length > 0 ? (reduced ? 0 : beat % fita.length) : -1;

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
    // a planta: as peças já desenhadas ficam no papel, apagadas como rascunho
    const slots = plantaRef.current ? Array.from(plantaRef.current.querySelectorAll<HTMLElement>("[data-peca]")) : [];
    slots.slice(0, written).forEach((slot, index) => {
      const box = boxOf(slot, origin);
      const kind = slot.dataset.peca;
      const strokes =
        kind === "capa"
          ? [frame(box, 0), [{ x: box.left, y: box.top + box.height }, { x: box.left + box.width, y: box.top }]]
          : kind === "grade"
            ? [frame(box, 0), ...[1, 2, 3, 4, 5, 6].map((col) => [{ x: box.left + (box.width * col) / 7, y: box.top }, { x: box.left + (box.width * col) / 7, y: box.top + box.height }]),
              ...[1, 2, 3].map((row) => [{ x: box.left, y: box.top + (box.height * row) / 4 }, { x: box.left + box.width, y: box.top + (box.height * row) / 4 }])]
            : [[{ x: box.left, y: box.top + box.height }, { x: box.left + box.width, y: box.top + box.height }]];
      gestures.push({ id: `planta:${index}`, layer: "over", strokes, width: kind === "barra" ? 3 : 1.4, cap: kind === "barra" ? "butt" : "round", dim: true });
    });
    // a fita: ele circula a capa que está olhando agora
    const leaves = fitaRef.current ? Array.from(fitaRef.current.querySelectorAll<HTMLElement>("[data-folha]")) : [];
    const looking = leaves[leaf];
    if (looking) {
      gestures.push({ id: `folha:${leaf}`, layer: "over", strokes: [circle(boxOf(looking, origin), `folha:${leaf}`, 5, { exponent: 3.4 })], width: 2, cap: "round" });
    }
    return { gestures, wave: null, notes: [] };
  }, [written, leaf]);
  const pen = usePen(stageRef, draw, `${headline}|${written}|${leaf}`, { first: 240 });

  return (
    <div
      ref={stageRef}
      className={styles.aviso}
      data-compact={compact || undefined}
      data-waiting={waiting || undefined}
      data-planta={planta}
      role={compact ? undefined : "status"}
    >
      {waiting && fita && fita.length > 0 && (
        <div className={styles.fita}>
          <div ref={fitaRef} className={styles.fitaCapas} aria-hidden="true">
            {fita.map((folha, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={folha.key} data-folha src={folha.coverUrl} alt="" data-on={index === leaf || undefined} />
            ))}
          </div>
          <p className={styles.fitaLegenda} aria-live="off">folheando: {fita[Math.max(0, leaf)]?.caption}</p>
        </div>
      )}
      <Fala
        level={1}
        window={when}
        headline={headline}
        narrative={slow && later ? later : narrative}
        markRef={markRef}
        marked={pen.started.has("grifo")}
      />
      {waiting && !planta && <div ref={draftRef} className={styles.draft} aria-hidden="true" />}
      {waiting && planta && (
        <div ref={plantaRef} className={styles.planta} data-planta={planta} aria-hidden="true">
          <div className={styles.plantaFala}>
            {PLANTAS[planta].fala.map((peca, index) => <i key={index} data-peca={peca.kind} style={{ width: `${(peca.share ?? 1) * 100}%` }} />)}
          </div>
          <div className={styles.plantaProva}>
            {PLANTAS[planta].prova.map((peca, index) => <i key={index} data-peca={peca.kind} style={peca.kind === "barra" ? { width: `${(peca.share ?? 1) * 100}%` } : undefined} />)}
          </div>
        </div>
      )}
      {children && <Respostas inline>{children}</Respostas>}
      <PenLayer pen={pen} signal={silence} reduced={reduced} />
    </div>
  );
}
