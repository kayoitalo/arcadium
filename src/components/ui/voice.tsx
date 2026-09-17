"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "framer-motion";

/**
 * A voz do Gemini fora da manchete. Dado é limpo; opinião vem neste
 * bloco mono, digitada como saída de terminal quando entra na tela.
 * O resto do texto já ocupa o espaço, invisível, então nada pula.
 */
/**
 * O mesmo quadro, enquanto o texto ainda está sendo escrito. A primeira
 * leitura de um período nasce na hora e leva dezenas de segundos: sem este
 * aviso, "gerando" e "quebrado" são a mesma tela — e quem troca de período
 * no meio cancela a chamada sem saber que cancelou.
 *
 * O LED piscando é o mesmo de Histórico, Descobertas e Evolução.
 */
export function VoicePending({
  label,
  children: hint,
  className = "",
}: {
  label: string;
  children: string;
  className?: string;
}) {
  return (
    <figure
      className={`m-0 flex flex-col border border-border bg-well ${className}`}
      aria-live="polite"
      aria-busy="true"
    >
      <figcaption className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5">
        <span className="eyebrow text-accent">{label}</span>
        <span className="led" data-on="true" style={{ animation: "gy-blink 0.7s steps(1) infinite" }} aria-hidden />
      </figcaption>
      <p className="data m-0 px-4 py-4 text-[13px] leading-relaxed text-text-muted">{hint}</p>
    </figure>
  );
}

export function Voice({
  label,
  children: text,
  size = "md",
  className = "",
}: {
  label: string;
  children: string;
  size?: "md" | "lg";
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10% 0px" });
  const reduced = useReducedMotion();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setCount(text.length);
      return;
    }

    setCount(0);
    const total = Math.min(1400, text.length * 14);
    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startedAt) / total);
      setCount(Math.round(t * text.length));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, reduced, text]);

  const typing = count < text.length;

  return (
    <figure ref={ref} className={`m-0 flex flex-col border border-border bg-well ${className}`}>
      <figcaption className="flex items-center justify-between gap-3 border-b border-rule px-4 py-2.5">
        <span className="eyebrow text-accent">{label}</span>
        <span className="led" data-on="true" aria-hidden />
      </figcaption>
      <p
        className={`voice-text m-0 px-4 py-4 ${
          size === "lg" ? "text-[clamp(1rem,1.7vw,1.25rem)]" : "text-[13px]"
        }`}
      >
        <span className="sr-only">{text}</span>
        <span aria-hidden>
          {text.slice(0, count)}
          {typing && <span className="caret" />}
          <span className="invisible">{text.slice(count)}</span>
        </span>
      </p>
    </figure>
  );
}
