"use client";
import { DISCOVERY_ENTRIES, TERRITORY_ENTRY } from "./discovery-view";
import styles from "./descobertas.module.css";
import { useRef, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { Fala, PenLayer } from "@/components/amigo/fala";
import { usePen } from "@/components/amigo/use-pen";
import { textLines } from "@/components/amigo/measure";
import { band } from "@/components/amigo/gestures";
import { Capa, shareName } from "@/components/amigo/fala";
import type { DiscoveryIntent } from "@/modules/recommendations/domain/discovery-intent";
import { SaiuAgora } from "./saiu-agora";

/**
 * A porta da descoberta: ele pergunta, você escolhe um caminho. Quem já tem
 * uma busca guardada vê primeiro onde parou. "Outro universo" abre os
 * destinos logo abaixo, sem buscar nada antes da escolha.
 */
export function DiscoveryEntry({ busy, hasSession, currentRank, total, territoryOpen, territory, onChoose, onResume, onTerritory, resumeCover, ownCovers = [] }: {
  busy: boolean; hasSession: boolean; currentRank: number; total: number; territoryOpen: boolean; territory?: ReactNode;
  /** A faixa onde a última busca parou: a capa dela abre a retomada. */
  resumeCover?: { url: string | null; title: string; artist: string; track: string } | null;
  /** Capas do que você ouviu por último: os caminhos que partem do teu gosto mostram de onde partem. */
  ownCovers?: string[];
  onChoose: (proximity: number, fame: number, intent: DiscoveryIntent) => void; onResume: () => void; onTerritory: () => void;
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
  const where = total === 0 ? "A última busca ficou guardada, mesmo sem indicação." : currentRank <= total ? `Você parou na indicação ${currentRank} de ${total}.` : "Tuas respostas ficaram guardadas.";
  const choice = (title: string, description: string, onClick: () => void, pressed?: boolean, covers: string[] = []) => <button className={styles.entryChoice} key={title}
    disabled={busy} onClick={onClick} aria-expanded={pressed}>
    <span>
      {/* o lugar das capas existe em todos os caminhos: os títulos ficam na mesma linha */}
      {<span className={styles.entryCovers} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {covers.slice(0, 3).map((url) => <img key={url} src={url} alt="" loading="lazy" />)}
      </span>}
      <strong>{title}</strong><span className={styles.entryDescription}>{description}</span>
    </span>
    <span className={styles.entryArrow} aria-hidden="true">{pressed ? "↓" : "→"}</span>
  </button>;
  return <section ref={stage} className={styles.entry} aria-label="Escolher caminho de descoberta">
    <div className={styles.entryIntro}>
      <Fala level={1} headline={"Hoje, a curiosidade\nvai por onde?"} narrative="Eu procuro, você dá o play. Uma faixa de cada vez."
        mark={["por onde?"]} markRef={mark} marked={pen.started.has("entry-curiosity")} />
    </div>
    {hasSession && <div className={styles.resumeStrip}>
      {resumeCover && <Capa cover={{ url: resumeCover.url, title: resumeCover.title, artist: resumeCover.artist }} label={false} className={styles.resumeCover}
        share={shareName(resumeCover.artist, resumeCover.track)} />}
      <p><strong>Tua última busca continua aqui.</strong> <span>{where}</span>{resumeCover && <span className={styles.resumeTrack}>{resumeCover.track} · {resumeCover.artist}</span>}</p>
      <button onClick={onResume} disabled={busy}>continuar de onde parei <span aria-hidden="true">→</span></button>
    </div>}
    <div className={styles.entryChoices}>
      {DISCOVERY_ENTRIES.filter((entry) => entry.intent !== "REPERTOIRE").map((entry, index) => choice(entry.title, entry.description, () => onChoose(entry.proximity, entry.fame, entry.intent), undefined, index === 0 ? ownCovers.slice(0, 3) : []))}
      {choice(TERRITORY_ENTRY.title, TERRITORY_ENTRY.description, onTerritory, territoryOpen)}
      {DISCOVERY_ENTRIES.filter((entry) => entry.intent === "REPERTOIRE").map((entry) => choice(entry.title, entry.description, () => onChoose(entry.proximity, entry.fame, entry.intent), undefined, ownCovers.slice(3, 6)))}
    </div>
    {territoryOpen && territory}
    <SaiuAgora />
    <PenLayer pen={pen} signal={signal} reduced={reduced} />
  </section>;
}
