"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useRef } from "react";
import { band } from "@/components/amigo/gestures";
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
      <p className={styles.eyebrow}>Tem coisa no teu fone que merece uma conversa.</p>
      <h1 id="login-title" className={styles.headline}>Teu gosto<br />tem <span ref={markRef} className={styles.highlight} data-marked={pen.started.has("grifo")}>história.</span></h1>
      <p className={styles.intro}>Aquela volta pro mesmo disco. A fase que passou.<br className={styles.desktopBreak} /> O artista que chegou pra ficar. Eu reparo nessas coisas.</p>
      <div className={styles.signature} aria-hidden="true">
        <div ref={lineRef} className={styles.waveSpace}>
          {reduced && <svg viewBox="0 0 640 76" preserveAspectRatio="none"><path d="M2 38H638" /></svg>}
        </div>
        <span>escutar é só o começo.</span>
      </div>
      <ul className={styles.topics} aria-label="O que a gente conversa">
        <li><span>01</span> o que voltou pro repeat</li>
        <li><span>02</span> o que mudou em você</li>
        <li><span>03</span> o que ainda falta ouvir</li>
      </ul>
      <Trace plan={pen.plan} size={pen.size} penWidth={1.5} reduced={reduced} readSignal={readSignal} onGesture={pen.onGesture} travelStyle="straight" />
    </section>
  );
}
