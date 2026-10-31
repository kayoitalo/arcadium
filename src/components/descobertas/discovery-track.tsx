"use client";
import type { ReactNode, RefObject } from "react";
import { Fala } from "@/components/amigo/fala";
import styles from "./descobertas.module.css";

export function DiscoveryTrack({ title, artist, reason, isRevisit, artwork, metadata, markRef, headlineRef, marked, sectionRef,
  onPlay, canPlay, playing, loading, onChangeEntry, entryLabel, index, total }: {
  title: string; artist: string; reason: string | null; isRevisit?: boolean; artwork: ReactNode; metadata: ReactNode;
  markRef: RefObject<HTMLSpanElement | null>; headlineRef?: RefObject<HTMLHeadingElement | null>;
  marked: boolean; sectionRef: RefObject<HTMLElement | null>; onPlay: () => void; canPlay: boolean; playing: boolean; loading: boolean;
  onChangeEntry: () => void; entryLabel: string; index: number; total: number;
}) {
  return <section className={styles.listening} aria-label="Escuta da descoberta">
    <div className={styles.sessionBar}>
      <span className={styles.eyebrow}>descoberta <span className={styles.barSlash}>/</span> {entryLabel}</span>
      <button className={styles.textButton} onClick={onChangeEntry}>trocar caminho ↗</button>
    </div>
    <p className={styles.pathContext}>{entryLabel === "Perto do que eu gosto"
      ? "Buscando novidades com ligações mais diretas ao teu repertório."
      : entryLabel === "Outras conexões"
        ? "Buscando ligações menos diretas. Pode haver novidades dentro dos gêneros que você já escuta."
        : "Buscando a partir dos ajustes que você escolheu no mapa."}</p>
    <div className={styles.block}>
      <div className={styles.trackCopy}>
        <section ref={sectionRef} aria-label="A sugestão da vez">
        <p className={styles.trackCounter}><span>{String(index + 1).padStart(2, "0")}</span> / {String(total).padStart(2, "0")} <i /> {isRevisit ? "uma revisita" : "separei essa pra você"}</p>
        <Fala className={styles.trackSpeech} level={1} headline={title} mark={[title]} markRef={markRef} headlineRef={headlineRef} marked={marked} />
        <p className={styles.artist}>{artist}</p>
        </section>
        <div className={styles.reason}><span className={styles.reasonMark} aria-hidden="true">↳</span><div>
          <h2>Por que essa?</h2><p>{reason ?? "Vale ouvir e me contar o que achou."}</p>
        </div></div>
        <div className={styles.listenControl}>
          <button className={styles.playButton} disabled={!canPlay} onClick={onPlay} aria-pressed={playing} aria-label={playing ? "Parar prévia" : "Ouvir prévia"}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{playing ? <path d="M7 7h10v10H7z" /> : <path d="m9 5 11 7-11 7z" />}</svg>
          </button><div><strong>{loading ? "Abrindo a prévia…" : playing ? "Ouvindo agora" : canPlay ? "Dá o play" : "Sem prévia por aqui"}</strong>
            <span>{canPlay ? "um primeiro encontro, em 30 segundos" : "a indicação continua valendo"}</span></div>
        </div>
        <div className={styles.meta}>{metadata}</div>
      </div>
      <div className={styles.record}>{artwork}<span className={styles.recordCaption}>escuta primeiro.<br /><span>o resto pode surpreender.</span></span></div>
    </div>
  </section>;
}
