"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { polyLength, toPath, travel, wave, type Point } from "./gestures";
import styles from "./estudo.module.css";

/*
 * O traço do amigo: o protagonista do estudo. É uma caneta só. Quando o
 * assunto muda, a tinta que estava na tela é puxada de volta, a ponta
 * viaja até o próximo alvo e desenha ali — nada aparece pronto, nada
 * corta. Com música tocando, a caneta vira uma corda presa nas duas
 * pontas, vibrando com o sinal de verdade.
 *
 * Cada quadro só mexe em atributos do SVG por referência: o React
 * desenha os caminhos uma vez por pose, e o resto é relógio.
 */

export type StrokeCap = "round" | "butt" | "square";
export type StrokeJoin = "round" | "miter";

export interface TraceGesture {
  id: string;
  /** "under" fica atrás do texto (o grifo); "over" fica por cima de tudo. */
  layer: "under" | "over";
  strokes: Point[][];
  width: number;
  /** Ponta e canto do traço; sem nada, os do estudo v1 (redondos). */
  cap?: StrokeCap;
  join?: StrokeJoin;
  /** Já foi dito: continua na tela, mais apagado que o assunto da vez. */
  dim?: boolean;
}

export interface WaveSpec {
  /** A linha em repouso: onde a corda está presa e por onde ela passa. */
  base: Point[];
  amp: number;
  /** A corda só vibra para longe deste ponto: em volta da capa, o centro dela. */
  outwardFrom?: Point;
  /** A linha já está desenhada ali (o arco do salto): a corda começa a vibrar no lugar. */
  inPlace?: boolean;
  /** Espessura e ponta da corda; sem nada, as da caneta. */
  width?: number;
  cap?: StrokeCap;
}

export interface TracePlan {
  key: string;
  gestures: TraceGesture[];
  wave: WaveSpec | null;
  /** Mesma pose, medida de novo (tela redimensionada): redesenha sem animar. */
  instant: boolean;
}

interface Segment {
  id: string;
  layer: "under" | "over";
  kind: "ink" | "travel" | "wave" | "erase";
  d: string;
  length: number;
  width: number;
  start: number;
  duration: number;
  gestureId?: string;
  closesGesture?: boolean;
  cap?: StrokeCap;
  join?: StrokeJoin;
  dim?: boolean;
}

const ERASE_MS = 220;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeIn = (t: number) => t * t * t;

/**
 * Quanto do pedaço aparece neste instante. `visible` existe porque traço de
 * comprimento zero com ponta redonda ainda pinta um ponto: abaixo de meio
 * pixel, o caminho some de vez.
 */
function dash(segment: Segment, progress: number): { array: string; offset: string; visible: number } {
  const { length, kind } = segment;
  const total = length + 2;
  if (kind === "erase") {
    const cut = easeIn(progress) * length;
    const rest = Math.max(0, length - cut);
    return { array: `${rest} ${total}`, offset: `${-cut}`, visible: rest };
  }
  if (kind === "travel") {
    const tail = Math.min(140, length * 0.55);
    const run = easeInOut(progress) * (length + tail);
    const head = clamp(run, 0, length);
    const back = clamp(run - tail, 0, length);
    return { array: `${head - back} ${total}`, offset: `${-back}`, visible: head - back };
  }
  const drawn = easeOut(progress) * length;
  return { array: `${drawn} ${total}`, offset: "0", visible: drawn };
}

/** O primeiro quadro, antes do relógio: tinta que sai começa inteira, o resto começa sem nada. */
function initialDash(segment: Segment): string | undefined {
  if (segment.kind === "erase") return `${segment.length} ${segment.length + 2}`;
  if (segment.duration === 0 && segment.kind !== "travel") return undefined;
  return `0 ${segment.length + 2}`;
}

const startsHidden = (segment: Segment) => initialDash(segment)?.startsWith("0 ") ?? false;

export function Trace({
  plan,
  size,
  penWidth,
  reduced,
  readSignal,
  onGesture,
  travelStyle = "curve",
}: {
  plan: TracePlan | null;
  size: { width: number; height: number };
  penWidth: number;
  reduced: boolean;
  /** O sinal da música neste quadro, ou null sem som. */
  readSignal: () => ArrayLike<number> | null;
  onGesture: (id: string, moment: "start" | "end") => void;
  /** Como a ponta anda entre um gesto e outro: em arco (v1) ou reta, como num diagrama (v2). */
  travelStyle?: "curve" | "straight";
}) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const nodes = useRef(new Map<string, SVGPathElement>());
  const pen = useRef<Point | null>(null);
  const clock = useRef({ t0: 0 });
  const live = useRef<{ spec: WaveSpec; readyAt: number } | null>(null);
  const segmentsRef = useRef<Segment[]>([]);
  const fired = useRef(new Set<string>());
  const onGestureRef = useRef(onGesture);
  onGestureRef.current = onGesture;
  const readRef = useRef(readSignal);
  readRef.current = readSignal;

  // uma pose nova vira uma fila de pedaços: apagar, viajar, desenhar
  useEffect(() => {
    if (!plan) return;
    const instant = reduced || plan.instant;
    const previous = segmentsRef.current;
    const queue: Segment[] = [];

    // o que já está na tela e continua no plano novo fica onde está: sem
    // apagar e redesenhar o mesmo grifo só porque a música começou a tocar
    const wanted = new Set(
      plan.gestures.flatMap((gesture) => gesture.strokes.filter((stroke) => stroke.length > 1).map(toPath)),
    );
    const waveBase = plan.wave && plan.wave.base.length > 1 ? toPath(plan.wave.base) : null;
    const onScreen = new Map(previous.filter((segment) => segment.kind === "ink").map((segment) => [segment.d, segment]));
    const previousWave = previous.find((segment) => segment.kind === "wave");

    if (!instant) {
      for (const segment of previous) {
        const stays =
          (segment.kind === "ink" && wanted.has(segment.d)) || (segment.kind === "wave" && segment.d === waveBase);
        if ((segment.kind === "ink" || segment.kind === "wave") && !stays) {
          queue.push({ ...segment, id: `${segment.id}~out`, kind: "erase", start: 0, duration: ERASE_MS });
        }
      }
    }

    let at: Point | null = pen.current;
    let cursor = instant ? 0 : previous.length > 0 ? 110 : 40;

    const travelTo = (target: Point, id: string) => {
      const from = at ?? { x: -60, y: target.y + 40 };
      const path = travelStyle === "straight" ? [from, target] : travel(from, target, `${plan.key}:${id}`);
      const length = polyLength(path);
      if (length < 8 || instant) return;
      const duration = clamp(length / 3.2, 160, 420);
      queue.push({ id: `${id}~go`, layer: "over", kind: "travel", d: toPath(path), length, width: penWidth, start: cursor, duration });
      cursor += duration * 0.85;
    };

    for (const gesture of plan.gestures) {
      gesture.strokes.forEach((stroke, index) => {
        if (stroke.length < 2) return;
        const id = `${plan.key}:${gesture.id}:${index}`;
        const d = toPath(stroke);
        const closesGesture = index === gesture.strokes.length - 1;
        const kept = onScreen.get(d);
        // a corda que para de tocar assenta no traço de onde saiu: o arco
        // volta a ser arco com seta, sem a caneta refazer o caminho
        const settles = !instant && previousWave !== undefined && d.startsWith(previousWave.d);
        const look = { cap: gesture.cap, join: gesture.join, dim: gesture.dim };
        if (kept || settles) {
          queue.push({
            id: kept?.id ?? id,
            layer: gesture.layer,
            kind: "ink",
            d,
            length: polyLength(stroke),
            width: gesture.width,
            start: 0,
            duration: 0,
            gestureId: gesture.id,
            closesGesture,
            ...look,
          });
          at = stroke[stroke.length - 1];
          return;
        }
        travelTo(stroke[0], id);
        const length = polyLength(stroke);
        const duration = instant ? 0 : clamp(length / (gesture.layer === "under" ? 2 : 1.9), 200, 640);
        queue.push({
          id,
          layer: gesture.layer,
          kind: "ink",
          d,
          length,
          width: gesture.width,
          start: cursor,
          duration,
          gestureId: gesture.id,
          closesGesture,
          ...look,
        });
        cursor += duration + (instant ? 0 : 50);
        at = stroke[stroke.length - 1];
      });
    }

    live.current = null;
    if (plan.wave && waveBase) {
      const { base } = plan.wave;
      const keptWave = previousWave && previousWave.d === waveBase ? previousWave : null;
      const id = keptWave?.id ?? `${plan.key}:wave`;
      const inPlace = instant || Boolean(plan.wave.inPlace) || keptWave !== null;
      if (!inPlace) travelTo(base[0], id);
      const length = polyLength(base);
      const duration = inPlace ? 0 : clamp(length / 1.9, 220, 620);
      queue.push({
        id,
        layer: "over",
        kind: "wave",
        d: waveBase,
        length,
        width: plan.wave.width ?? penWidth,
        start: inPlace ? 0 : cursor,
        duration,
        cap: plan.wave.cap,
      });
      // corda que já vibrava não recomeça a rampa
      live.current = { spec: plan.wave, readyAt: keptWave ? -1000 : inPlace ? 0 : cursor + duration };
      at = base[base.length - 1];
    }

    pen.current = at;
    fired.current = new Set();
    clock.current.t0 = performance.now();
    segmentsRef.current = queue.filter((segment) => segment.kind !== "erase");
    setSegments(queue);
    // a medida muda a cada pose; o plano inteiro é a dependência de verdade
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan]);

  // o relógio: roda enquanto houver pedaço em movimento ou corda viva
  useLayoutEffect(() => {
    let frame = 0;
    const tick = () => {
      const elapsed = performance.now() - clock.current.t0;
      let busy = false;

      for (const segment of segments) {
        const node = nodes.current.get(segment.id);
        if (!node) continue;
        const progress = segment.duration === 0 ? 1 : clamp((elapsed - segment.start) / segment.duration, 0, 1);
        if (progress < 1) busy = true;

        if (segment.kind === "wave" && live.current && elapsed >= live.current.readyAt) {
          // corda viva: o ganho entra em rampa para a corda não estalar
          const gain = clamp((elapsed - live.current.readyAt) / 420, 0, 1);
          const { base, amp, outwardFrom } = live.current.spec;
          node.setAttribute("d", toPath(wave(base, amp, readRef.current(), gain, outwardFrom)));
          node.removeAttribute("stroke-dasharray");
          node.removeAttribute("stroke-dashoffset");
          node.style.visibility = "visible";
          busy = true;
          continue;
        }

        const { array, offset, visible } = dash(segment, progress);
        node.setAttribute("stroke-dasharray", array);
        node.setAttribute("stroke-dashoffset", offset);
        node.style.visibility = visible > 0.5 ? "visible" : "hidden";

        if (segment.kind === "ink" && segment.gestureId) {
          const startKey = `${segment.gestureId}:start`;
          if (progress > 0 && !fired.current.has(startKey)) {
            fired.current.add(startKey);
            onGestureRef.current(segment.gestureId, "start");
          }
          const endKey = `${segment.gestureId}:end`;
          if (segment.closesGesture && progress >= 1 && !fired.current.has(endKey)) {
            fired.current.add(endKey);
            onGestureRef.current(segment.gestureId, "end");
          }
        }
      }

      if (busy) frame = requestAnimationFrame(tick);
      else setSegments((current) => (current.some((segment) => segment.kind === "erase") ? current.filter((segment) => segment.kind !== "erase") : current));
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [segments]);

  const layer = (which: "under" | "over") => (
    <svg
      className={styles.trace}
      data-layer={which}
      width={size.width}
      height={size.height}
      viewBox={`0 0 ${size.width} ${size.height}`}
      aria-hidden
    >
      {segments
        .filter((segment) => segment.layer === which)
        .map((segment) => (
          <path
            key={segment.id}
            ref={(node) => {
              if (node) nodes.current.set(segment.id, node);
              else nodes.current.delete(segment.id);
            }}
            d={segment.d}
            strokeWidth={segment.width}
            strokeDasharray={initialDash(segment)}
            // estilo em linha: o CSS do traço fixa ponta redonda, e atributo de SVG perde para ele
            style={{
              visibility: startsHidden(segment) ? "hidden" : undefined,
              strokeLinecap: segment.cap,
              strokeLinejoin: segment.join,
            }}
            data-kind={segment.kind}
            data-dim={segment.dim || undefined}
          />
        ))}
    </svg>
  );

  return (
    <>
      {layer("under")}
      {layer("over")}
    </>
  );
}
