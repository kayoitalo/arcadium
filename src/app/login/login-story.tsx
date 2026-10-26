"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { band, frame } from "@/components/amigo/gestures";
import { textLines } from "@/components/amigo/measure";
import { Trace, type TraceGesture } from "@/components/amigo/trace";
import { usePen, type PenDrawing } from "@/components/amigo/use-pen";
import styles from "./login.module.css";

type Pose = "grifo" | "contorno" | "linha";
const NEXT: Record<Pose, Pose> = { grifo: "contorno", contorno: "linha", linha: "grifo" };
const HOLD: Record<Pose, number> = { grifo: 2800, contorno: 2400, linha: 3500 };

export function LoginStory() {
  const reduced = Boolean(useReducedMotion());
  const stageRef = useRef<HTMLElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const signal = useRef(new Float32Array(256));
  const [pose, setPose] = useState<Pose>("grifo");
  const activePose = reduced ? "grifo" : pose;

  const draw = useCallback((origin: DOMRect): PenDrawing | null => {
    if (!lineRef.current || !markRef.current) return null;
    const { lines, size } = textLines(markRef.current, origin);
    if (lines.length === 0) return null;
    const { strokes, width } = band(lines, size);
    const thin = Math.max(1.5, Math.min(2.5, origin.width / 600));
    const gestures: TraceGesture[] = activePose === "linha" ? [] : [
      { id: "grifo", layer: "under", strokes, width, cap: "butt" },
    ];
    if (activePose === "contorno") {
      const first = strokes[0];
      const inkBox = { left: first[0].x, top: first[0].y - width / 2, width: first[first.length - 1].x - first[0].x, height: width };
      gestures.push({ id: "contorno", layer: "over", strokes: [frame(inkBox, 6)], width: thin, cap: "square", join: "miter" });
    }
    const line = lineRef.current.getBoundingClientRect();
    const y = line.top - origin.top + line.height / 2;
    return {
      gestures,
      wave: activePose !== "linha" ? null : {
        base: [{ x: line.left - origin.left + 2, y }, { x: line.right - origin.left - 2, y }],
        amp: Math.min(22, line.height * 0.36),
        width: thin,
        cap: "square",
      },
      notes: [],
    };
  }, [activePose]);
  const pen = usePen(stageRef, draw, `login:${activePose}`, { first: 240 });
  const ready = Boolean(pen.plan);
  const forget = pen.forget;

  useEffect(() => {
    if (reduced || !ready) return;
    let timer = 0;
    const advance = () => {
      // Finish the current gesture, but do not start another while typing.
      if (document.hidden || document.activeElement?.closest("form")) {
        timer = window.setTimeout(advance, 800);
        return;
      }
      const next = NEXT[pose];
      if (next === "grifo") forget("grifo");
      if (next === "contorno") forget("contorno");
      setPose(next);
    };
    timer = window.setTimeout(advance, HOLD[pose]);
    return () => window.clearTimeout(timer);
  }, [pose, reduced, ready, forget]);

  const marked = pen.plan?.gestures.some((gesture) => gesture.id === "grifo") && pen.started.has("grifo");

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
    <section ref={stageRef} className={styles.story} aria-labelledby="login-title" data-pose={activePose}>
      <h1 id="login-title" className={styles.headline}>Teu gosto<br />tem <span ref={markRef} className={styles.highlight} data-marked={marked}>história.</span></h1>
      <p className={styles.intro}>O que voltou pro repeat. O que mudou. O que ainda falta ouvir.</p>
      <div className={styles.signature} aria-hidden="true">
        <div ref={lineRef} className={styles.waveSpace}>
          {reduced && <svg viewBox="0 0 640 76" preserveAspectRatio="none"><path d="M2 38H638" /></svg>}
        </div>
      </div>
      <Trace plan={pen.plan} size={pen.size} penWidth={Math.max(1.5, Math.min(2.5, pen.size.width / 600))} reduced={reduced} readSignal={readSignal} onGesture={pen.onGesture} travelStyle="straight" />
    </section>
  );
}
