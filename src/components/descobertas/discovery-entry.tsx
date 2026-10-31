"use client";
import { DISCOVERY_ENTRIES } from "./discovery-view";
import styles from "./descobertas.module.css";

export function DiscoveryEntry({ busy, hasSession, currentRank, total, onChoose, onResume, onAdjust }: {
  busy: boolean; hasSession: boolean; currentRank: number; total: number;
  onChoose: (proximity: number, fame: number) => void; onResume: () => void; onAdjust: () => void;
}) {
  return <section className={styles.entry} aria-labelledby="discovery-entry-title">
    <p className={styles.eyebrow}><span className={styles.smallRule} /> descoberta musical</p>
    <div className={styles.entryIntro}>
      <h1 id="discovery-entry-title">Hoje, a curiosidade<br />vai <span className={styles.drawnWord}>por onde?
        <svg viewBox="0 0 440 22" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M3 14 C92 5 260 7 435 10 M63 20 C190 12 300 12 393 15" /></svg>
      </span></h1>
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
  </section>;
}
