"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useRef, type ReactNode } from "react";
import { DiscoveryDisclosure } from "@/components/descobertas/discovery-disclosure";
import { QuemPuxou } from "./quem-puxou";
import type { GenreMovers } from "@/modules/statistics/application/genre-movers";
import { Fala, PenLayer } from "@/components/amigo/fala";
import { band } from "@/components/amigo/gestures";
import { boxOf, textLines } from "@/components/amigo/measure";
import type { TraceGesture } from "@/components/amigo/trace";
import { usePen, type PenDrawing } from "@/components/amigo/use-pen";
import { genreLabel } from "@/lib/format/genre";
import { shiftSentence } from "@/modules/conversation/domain/shift-line";
import type { TasteShiftItem } from "@/modules/statistics/application/overview-service";
import styles from "./mudou.module.css";

const decimal = (value: number) => value.toString().replace(".", ",");

/** "+5,5 pontos", "−1,9 ponto": abaixo de dois, ponto fica no singular. */
function points(delta: number): string {
  const size = Math.abs(delta);
  return `${delta > 0 ? "+" : "−"}${decimal(size)} ${size < 2 ? "ponto" : "pontos"}`;
}

type Register = (key: string) => (node: HTMLElement | null) => void;
const ignore: Register = () => () => undefined;

function Linha({
  item,
  scale,
  cited,
  lit,
  register,
}: {
  item: TasteShiftItem;
  scale: number;
  /** Ele cita este gênero: a linha é grande e a anotação espera o traço terminar. */
  cited: boolean;
  lit: boolean;
  register: Register;
}) {
  const from = (item.previousShare / scale) * 100;
  const to = (item.currentShare / scale) * 100;
  return (
    <li className={styles.row} data-lit={lit} data-cited={cited || undefined}>
      <span className={styles.label}>{genreLabel(item.genre)}</span>
      <span className={styles.value}>
        {decimal(item.previousShare)}% → {decimal(item.currentShare)}%
      </span>
      <span className={styles.track} aria-hidden="true">
        <span className={styles.segment} style={{ left: `${Math.min(from, to)}%`, width: `${Math.abs(to - from)}%` }} />
        <span ref={register(`de:${item.genre}`)} className={styles.from} style={{ left: `${from}%` }} />
        <span ref={register(`para:${item.genre}`)} className={styles.to} style={{ left: `${to}%` }} />
      </span>
      {cited && <span className={styles.note} data-lit={lit}>{points(item.delta)}</span>}
    </li>
  );
}

/**
 * O que mudou, janela contra janela anterior. Uma lógica só na tela: a
 * frase fala em fatia da escuta, e a prova é a mesma fatia — antes e agora,
 * dos gêneros que ela cita, com o traço dele percorrendo o caminho de um
 * ao outro. Embaixo de cada um, os discos que puxaram (em audições, com a
 * unidade escrita). O resto dos gêneros fica a um clique.
 */
export function Mudou({
  shift,
  headline,
  cited,
  window: when,
  movers = null,
}: {
  shift: { rising: TasteShiftItem[]; declining: TasteShiftItem[] };
  /** Os discos que puxaram a mudança: chegam depois, e a tela não espera por eles. */
  movers?: GenreMovers | null;
  headline: string;
  /** Os gêneros que a fala cita, na ordem em que ele fala deles. */
  cited: string[];
  window: ReactNode;
}) {
  const reduced = Boolean(useReducedMotion());
  const stageRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const parts = useRef(new Map<string, HTMLElement>());
  const silence = useRef<ArrayLike<number> | null>(null);

  const register = useCallback<Register>(
    (key) => (node) => {
      if (node) parts.current.set(key, node);
      else parts.current.delete(key);
    },
    [],
  );

  const items = [...shift.rising, ...shift.declining];
  const citedItems = cited
    .map((genre) => items.find((item) => item.genre === genre))
    .filter((item): item is TasteShiftItem => Boolean(item))
    .slice(0, 2);
  // o que subiu primeiro, como a frase conta ("menos pop, mais hip hop" mostra hip hop em cima)
  const shown = [...citedItems].sort((a, b) => b.delta - a.delta);
  const rest = items.filter((item) => !citedItems.includes(item));
  // uma escala só pra todas as trilhas, senão as distâncias mentem
  const scale = Math.max(1, ...items.flatMap((item) => [item.previousShare, item.currentShare]));
  const moversOf = (item: TasteShiftItem) =>
    movers?.rising?.genre === item.genre ? movers.rising.albums : movers?.falling?.genre === item.genre ? movers.falling.albums : [];

  const draw = (origin: DOMRect): PenDrawing => {
    const gestures: TraceGesture[] = [];
    const mark = markRef.current;
    if (mark) {
      const { lines, size } = textLines(mark, origin);
      if (lines.length > 0) {
        const { strokes, width } = band(lines, size);
        gestures.push({ id: "grifo", layer: "under", strokes, width, cap: "butt" });
      }
    }
    for (const item of shown) {
      const from = parts.current.get(`de:${item.genre}`);
      const to = parts.current.get(`para:${item.genre}`);
      if (!from || !to) continue;
      const [a, b] = [boxOf(from, origin), boxOf(to, origin)];
      const [ax, bx] = [a.left + a.width / 2, b.left + b.width / 2];
      const direction = Math.sign(bx - ax) || 1;
      const y = a.top + a.height / 2;
      // de borda a borda: os dois quadrados continuam à vista, o caminho entre eles é dele
      gestures.push({
        id: `trilha:${item.genre}`,
        layer: "over",
        strokes: [[{ x: ax + (direction * a.width) / 2, y }, { x: bx - (direction * b.width) / 2, y }]],
        width: 4,
        cap: "butt",
      });
    }
    return { gestures, wave: null, notes: [] };
  };

  const pose = `${headline}|${shown.map((item) => item.genre).join(",")}|${movers ? "discos" : ""}`;
  const pen = usePen(stageRef, draw, pose);

  return (
    <div ref={stageRef} className={styles.stage}>
      <div className={styles.block}>
        <Fala
          level={1}
          window={when}
          headline={headline}
          narrative={shiftSentence(citedItems)}
          markRef={markRef}
          marked={pen.started.has("grifo")}
          mark={citedItems.flatMap((item) => [genreLabel(item.genre), item.genre])}
        />
        <div className={styles.proof}>
          <p className={styles.legend}>
            <span className={styles.legendFrom} aria-hidden="true" /> antes <span className={styles.legendTo} aria-hidden="true" /> agora · fatia da escuta com gênero conhecido
          </p>
          {shown.map((item) => (
            <section key={item.genre} className={styles.cited} aria-label={genreLabel(item.genre)}>
              <ol className={styles.rows}>
                <Linha item={item} scale={scale} cited lit={pen.done.has(`trilha:${item.genre}`)} register={register} />
              </ol>
              <QuemPuxou albums={moversOf(item)} />
            </section>
          ))}
          {rest.length > 0 && (
            <DiscoveryDisclosure className={styles.numbers} bodyClassName={styles.numbersBody} summary="ver todos os gêneros">
              <ol className={styles.rows}>
                {rest.map((item) => <Linha key={item.genre} item={item} scale={scale} cited={false} lit={false} register={ignore} />)}
              </ol>
            </DiscoveryDisclosure>
          )}
        </div>
      </div>
      <PenLayer pen={pen} signal={silence} reduced={reduced} />
    </div>
  );
}
