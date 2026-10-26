"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useRef } from "react";
import { Trace } from "@/components/amigo/trace";
import { usePen, type PenDrawing } from "@/components/amigo/use-pen";
import styles from "./login.module.css";

export function LoginStory() {
  const reduced = Boolean(useReducedMotion());
  const stageRef = useRef<HTMLElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const signal = useRef(new Float32Array(256));

  const draw = useCallback((origin: DOMRect): PenDrawing | null => {
    if (!lineRef.current) return null;
    const line = lineRef.current.getBoundingClientRect();
    const y = line.top - origin.top + line.height / 2;
    return {
      gestures: [],
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
      <h1 id="login-title" className={styles.headline}>Teu gosto<br />tem <span className={styles.highlight}>
        <span className={styles.word}>história.</span>
        <span className={styles.markedWord} aria-hidden="true">história.</span>
      </span></h1>
      <p className={styles.intro}>O que voltou pro repeat. O que mudou. O que ainda falta ouvir.</p>
      <div className={styles.signature} aria-hidden="true">
        <div ref={lineRef} className={styles.waveSpace}>
          {reduced && <svg viewBox="0 0 640 76" preserveAspectRatio="none"><path d="M2 38H638" /></svg>}
        </div>
      </div>
      <Trace plan={pen.plan} size={pen.size} penWidth={1.5} reduced={reduced} readSignal={readSignal} onGesture={pen.onGesture} travelStyle="straight" />
    </section>
  );
}
