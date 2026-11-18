"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { clock, progressOf, rulerMarks } from "@/lib/music/preview-ruler";
import styles from "./amigo.module.css";

/**
 * A régua da prévia que está tocando: o trecho medido como cota de
 * desenho técnico, com marcas de 5 em 5 segundos. O que já tocou fica em
 * tinta (a cor dele é do traço, e o traço já está na capa, como corda).
 * Clicar ou arrastar pula pra outro ponto; as setas andam 5 segundos.
 */
export function Regua({ read, onSeek }: {
  /** Onde a prévia está agora; `null` enquanto não há o que medir. */
  read: () => { time: number; duration: number } | null;
  onSeek: (seconds: number) => void;
}) {
  const fill = useRef<HTMLSpanElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState({ time: 0, duration: 0 });
  const readRef = useRef(read);
  readRef.current = read;

  useEffect(() => {
    let frame = 0;
    let last = -1;
    const tick = () => {
      const now = readRef.current();
      if (now) {
        fill.current?.style.setProperty("scale", `${progressOf(now.time, now.duration)} 1`);
        // o texto do tempo só muda de segundo em segundo: o resto é a barra, por referência
        const second = Math.floor(now.time);
        if (second !== last || !Number.isFinite(last)) {
          last = second;
          setShown((current) => (Math.floor(current.time) === second && current.duration === now.duration ? current : now));
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const { duration } = shown;
  const known = Number.isFinite(duration) && duration > 0;
  const seekAt = (clientX: number) => {
    const box = track.current?.getBoundingClientRect();
    if (!box || !known || box.width === 0) return;
    onSeek(Math.min(1, Math.max(0, (clientX - box.left) / box.width)) * duration);
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    seekAt(event.clientX);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) seekAt(event.clientX);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!known) return;
    const now = readRef.current()?.time ?? 0;
    const step = event.key === "ArrowRight" ? 5 : event.key === "ArrowLeft" ? -5 : event.key === "Home" ? -now : event.key === "End" ? duration : 0;
    if (step === 0) return;
    event.preventDefault();
    // a tecla é da régua: os atalhos da tela (→ pula a faixa) não podem ouvir
    event.stopPropagation();
    onSeek(Math.min(duration, Math.max(0, now + step)));
  };

  return (
    <div className={styles.ruler}>
      <div ref={track} className={styles.rulerTrack} role="slider" tabIndex={0} aria-label="Posição na prévia"
        aria-valuemin={0} aria-valuemax={known ? Math.round(duration) : 30} aria-valuenow={Math.floor(shown.time)}
        aria-valuetext={`${clock(shown.time)} de ${clock(known ? duration : 30)}`}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onKeyDown={onKeyDown}>
        <span className={styles.rulerLine} aria-hidden="true"><span ref={fill} className={styles.rulerFill} /></span>
        {rulerMarks(known ? duration : 30).map((mark) => (
          <i key={mark.seconds} className={styles.rulerMark} data-major={mark.major || undefined} style={{ left: `${mark.at * 100}%` }} aria-hidden="true" />
        ))}
      </div>
      <p className={styles.rulerTime} aria-hidden="true">
        <span>{clock(shown.time)}</span>
        <span>{clock(known ? duration : 30)}</span>
      </p>
    </div>
  );
}
