"use client";
import { DISCOVERY_ENTRIES } from "./discovery-view";
import styles from "./descobertas.module.css";
import { useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { Fala, PenLayer } from "@/components/amigo/fala";
import { usePen } from "@/components/amigo/use-pen";
import { textLines } from "@/components/amigo/measure";
import { band } from "@/components/amigo/gestures";

export function DiscoveryEntry({ busy, hasSession, currentRank, total, onChoose, onResume, onAdjust }: {
  busy: boolean; hasSession: boolean; currentRank: number; total: number;
  onChoose: (proximity: number, fame: number) => void; onResume: () => void; onAdjust: () => void;
}) {
  const stage = useRef<HTMLElement>(null);
  const signal = useRef<ArrayLike<number> | null>(null);
  const mark = useRef<HTMLSpanElement>(null);
  const reduced = Boolean(useReducedMotion());
  const pen = usePen(stage, (origin) => {
    if (!mark.current) return null;
    const { lines, size } = textLines(mark.current, origin);
    const { strokes, width } = band(lines, size);
    return { gestures: [{ id: "entry-curiosity", layer: "under", strokes, width, cap: "butt" }], wave: null, notes: [] };
  }, "entry-curiosity");
  return <section ref={stage} className={styles.entry} aria-label="Escolher caminho de descoberta">
    <p className={styles.eyebrow}><span className={styles.smallRule} /> descoberta musical</p>
    <div className={styles.entryIntro}>
      <Fala level={1} headline={"Hoje, a curiosidade\nvai por onde?"} mark={["por onde?"]} markRef={mark} marked={pen.started.has("entry-curiosity")} />
      <p>Eu encontro as pistas.<br />Você dá o próximo play.<br /><small>Os dois caminhos partem do teu repertório.</small></p>
    </div>
    <div className={styles.entryChoices}>
      {DISCOVERY_ENTRIES.map((entry) => <button className={styles.entryChoice} key={entry.id} disabled={busy}
        onClick={() => onChoose(entry.proximity, entry.fame)}>
        <span className={styles.entryNumber}>{entry.number}</span>
        <span><strong>{entry.title}</strong><span className={styles.entryDescription}>{entry.description}</span></span>
        <span className={styles.entryArrow} aria-hidden="true">↗</span>
      </button>)}
    </div>
    <div className={styles.entryFooter}>
      <p>Uma faixa de cada vez.<br /><span>O resto a gente descobre ouvindo.</span></p>
      <button className={styles.textButton} onClick={onAdjust} disabled={busy}>quero ajustar o caminho <span aria-hidden="true">↘</span></button>
    </div>
    {hasSession && <div className={styles.resumeStrip}>
      <span className={styles.resumeMark} aria-hidden="true">↳</span>
      <p><strong>A tua última busca continua aqui.</strong><span>{currentRank <= total ? `Você parou na indicação ${currentRank} de ${total}.` : "As indicações e respostas ficaram guardadas."}</span></p>
      <button onClick={onResume} disabled={busy}>continuar <span aria-hidden="true">→</span></button>
    </div>}
    <PenLayer pen={pen} signal={signal} reduced={reduced} />
  </section>;
}
