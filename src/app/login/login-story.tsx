"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useRef } from "react";
import { band, toPath } from "@/components/amigo/gestures";
import { textLines } from "@/components/amigo/measure";
import { Trace } from "@/components/amigo/trace";
import { usePen, type PenDrawing } from "@/components/amigo/use-pen";
import styles from "./login.module.css";

export function LoginStory() {
  const reduced = Boolean(useReducedMotion());
  const stageRef = useRef<HTMLElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const signal = useRef(new Float32Array(256));

  const draw = useCallback((origin: DOMRect): PenDrawing | null => {
    if (!markRef.current || !lineRef.current) return null;
    const { lines, size } = textLines(markRef.current, origin);
    const { strokes, width } = band(lines, size);
    const line = lineRef.current.getBoundingClientRect();
    const y = line.top - origin.top + line.height / 2;
    return {
      gestures: [{ id: "grifo", layer: "under", strokes, width, cap: "butt" }],
      wave: reduced ? null : {
        base: [{ x: line.left - origin.left + 2, y }, { x: line.right - origin.left - 2, y }],
        amp: Math.min(22, line.height * 0.36),
        width: 1.5,
        cap: "butt",
      },
      notes: [],
    };
  }, [reduced]);
  const pen = usePen(stageRef, draw, reduced ? "login-still" : "login-live", { first: 240 });

  const markStroke = pen.plan?.gestures[0]?.strokes[0];
  const waveBase = pen.plan?.wave?.base;
  const loopPath = markStroke && waveBase && waveBase.length > 1 ? toPath([
    waveBase[waveBase.length - 1],
    { x: pen.size.width + 12, y: waveBase[waveBase.length - 1].y },
    { x: pen.size.width + 12, y: markStroke[markStroke.length - 1].y },
    ...markStroke.toReversed(),
    { x: -12, y: markStroke[0].y },
    { x: -12, y: waveBase[0].y },
    ...waveBase,
  ]) : null;

  // Ambient motion only: the login never starts audio or reads a microphone.
  const readSignal = useCallback(() => {
    if (reduced || document.hidden) return null;
    const time = performance.now() / 1000;
    const samples = signal.current;
    for (let index = 0; index < samples.length; index += 1) {
      const x = index / samples.length;
      samples[index] = 128 + 34 * Math.sin(x * Math.PI * 10 - time * 1.8)
        + 13 * Math.sin(x * Math.PI * 18 + time * 1.1);
    }
    return samples;
  }, [reduced]);

  return (
    <section ref={stageRef} className={styles.story} aria-labelledby="login-title">
      <h1 id="login-title" className={styles.headline}>Teu gosto<br />tem <span ref={markRef} className={styles.highlight} data-marked={pen.started.has("grifo")}>história.</span></h1>
      <p className={styles.intro}>O que voltou pro repeat. O que mudou. O que ainda falta ouvir.</p>
      <div className={styles.signature} aria-hidden="true">
        <div ref={lineRef} className={styles.waveSpace}>
          {reduced && <svg viewBox="0 0 640 76" preserveAspectRatio="none"><path d="M2 38H638" /></svg>}
        </div>
      </div>
      <Trace plan={pen.plan} size={pen.size} penWidth={1.5} reduced={reduced} readSignal={readSignal} onGesture={pen.onGesture} travelStyle="straight" />
      {!reduced && loopPath && pen.done.has("grifo") && (
        <svg className={styles.penLoop} width={pen.size.width} height={pen.size.height} viewBox={`0 0 ${pen.size.width} ${pen.size.height}`} aria-hidden="true">
          <path d={loopPath} pathLength="1" />
        </svg>
      )}
    </section>
  );
}
