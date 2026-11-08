"use client";
import type { ReactNode, RefObject } from "react";
import { Fala } from "@/components/amigo/fala";
import { splitTrackTitle } from "@/lib/music/track-title";
import styles from "./descobertas.module.css";

/**
 * A faixa da vez: a fala dele à esquerda (como na Conversa), a capa à
 * direita. Sem trecho, o play não fica desligado na tela: a escuta segue
 * por fora, num link.
 */
export function DiscoveryTrack({ title, artist, reason, artwork, metadata, markRef, headlineRef, marked, sectionRef,
  onPlay, canPlay, playing, loading, inAlbum = false, repertoire = false, context, listenElsewhere }: {
  title: string; artist: string; reason: string | null; artwork: ReactNode; metadata: ReactNode;
  markRef: RefObject<HTMLSpanElement | null>; headlineRef?: RefObject<HTMLHeadingElement | null>;
  marked: boolean; sectionRef: RefObject<HTMLElement | null>; onPlay: () => void; canPlay: boolean; playing: boolean; loading: boolean;
  /** Um disco em ordem: o motivo fala do ponto do disco. */
  inAlbum?: boolean;
  /** Do repertório: o trecho é um reencontro, não uma novidade. */
  repertoire?: boolean;
  /** A linha de cima: onde essa faixa está no caminho e como mudar o rumo. */
  context: ReactNode;
  /** Onde ouvir quando não há trecho por aqui. */
  listenElsewhere?: ReactNode;
}) {
  const shown = splitTrackTitle(title);
  return <section className={styles.listening} aria-label="Escuta da descoberta">
    <div className={styles.sessionBar}>{context}</div>
    <div className={styles.block}>
      <section ref={sectionRef} className={styles.head} aria-label="A sugestão da vez">
        <Fala className={styles.trackSpeech} level={1} headline={shown.title} mark={[shown.title]} markRef={markRef} headlineRef={headlineRef} marked={marked} />
      </section>
      <div className={styles.byline}>
        <p className={styles.artist}>{artist}</p>
        <p className={styles.meta}>{shown.edition && <>{shown.edition} · </>}{metadata}</p>
      </div>
      <div className={styles.reason}>
        <h2>{inAlbum ? "Neste ponto do disco" : "Por que essa?"}</h2><p>{reason ?? "Vale ouvir e me contar o que achou."}</p>
      </div>
      {canPlay || loading ? <div className={styles.listenControl}>
        <button className={styles.playButton} disabled={!canPlay} onClick={onPlay} aria-pressed={playing} aria-label={playing ? "Parar prévia" : "Ouvir prévia"}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{playing ? <path d="M7 7h10v10H7z" /> : <path d="m9 5 11 7-11 7z" />}</svg>
        </button>
        <div><strong>{loading ? "Abrindo a prévia…" : playing ? "Ouvindo agora" : "Dá o play"}</strong><span>{repertoire ? "um reencontro, em 30 segundos" : "um trecho, em 30 segundos"}</span></div>
      </div> : <div className={styles.listenElsewhere}>
        <strong>Sem trecho por aqui.</strong>{listenElsewhere}
      </div>}
      <div className={styles.record}>{artwork}{canPlay && <span className={styles.recordCaption}>escuta primeiro.<br /><span>o resto pode surpreender.</span></span>}</div>
    </div>
  </section>;
}
