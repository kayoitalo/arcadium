"use client";

import { useEffect, useState } from "react";
import { dateOf, type Dia } from "@/components/amigo/use-fita";
import { coverProxyUrl } from "@/lib/cover";
import { privateFetch } from "@/lib/http/private-fetch";
import { cleanTitle } from "@/lib/music/track-title";
import type { NowPlaying } from "@/modules/listening/application/now-playing";
import styles from "./conversa.module.css";

/** De minuto em minuto, só com a aba à vista: o Last.fm diz se tem algo tocando agora. */
function useNowPlaying(): NowPlaying | null {
  const [playing, setPlaying] = useState<NowPlaying | null>(null);
  useEffect(() => {
    let alive = true;
    let timer = 0;
    const ask = async () => {
      if (document.visibilityState === "visible") {
        try {
          const response = await privateFetch("/api/now-playing", { cache: "no-store" });
          const payload = response.ok ? ((await response.json()) as { playing: NowPlaying | null }) : null;
          if (alive && payload) setPlaying(payload.playing);
        } catch { /* sem resposta, a linha fica como estava */ }
      }
      if (alive) timer = window.setTimeout(ask, 60_000);
    };
    void ask();
    const back = () => { if (document.visibilityState === "visible") { window.clearTimeout(timer); void ask(); } };
    document.addEventListener("visibilitychange", back);
    return () => { alive = false; window.clearTimeout(timer); document.removeEventListener("visibilitychange", back); };
  }, []);
  return playing;
}

/**
 * O cabeçalho do dia, em cima do fio: a data, quanto tocou nas últimas 24
 * horas, a última audição e a fita das capas desse tempo. Só o que foi
 * observado; sem nada tocado, fica só a data. Se algo está tocando agora, a
 * linha vira "tocando agora", com a capa e uma corda curta vibrando.
 *
 * Sem `dia`, o histórico ainda não chegou: a data já aparece e o resto
 * guarda o lugar, pra manchete não descer quando ele chegar. Se ele falhou,
 * a data fica e a linha diz isso, com como tentar de novo.
 */
export function DiaDeHoje({ dia, failed = false, onRetry }: { dia: Dia | null; failed?: boolean; onRetry?: () => void }) {
  const playing = useNowPlaying();
  if (!dia && failed) {
    return (
      <header className={styles.dia}>
        <div className={styles.diaTopo}>
          <p className={styles.diaData}><span data-dia>{dateOf()}</span></p>
          <p className={styles.diaConta} role="status">
            não consegui ler o que tocou agora
            {onRetry && <> · <button type="button" className={styles.diaTentar} onClick={onRetry}>tenta de novo</button></>}
          </p>
        </div>
      </header>
    );
  }
  if (!dia) {
    return (
      <header className={styles.dia} data-pending aria-busy="true">
        <div className={styles.diaTopo}>
          <p className={styles.diaData}><span data-dia>{dateOf()}</span></p>
          <p className={styles.diaConta} />
        </div>
        <div className={styles.diaFitaVazia} aria-hidden="true" />
      </header>
    );
  }
  const plays = dia.plays === 0 ? null : `${dia.atLeast ? "pelo menos " : ""}${dia.plays.toLocaleString("pt-BR")} ${dia.plays === 1 ? "audição" : "audições"}`;
  return (
    <header className={styles.dia}>
      <div className={styles.diaTopo}>
        <p className={styles.diaData}><span data-dia>{dia.date}</span></p>
        {playing ? (
          <p className={styles.diaAgora} aria-live="polite">
            {playing.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={coverProxyUrl(playing.coverUrl) ?? undefined} alt="" />
            )}
            <span><span className={styles.diaAgoraRotulo}>tocando agora</span> <b>{cleanTitle(playing.track)}</b> · {playing.artist}</span>
            <svg className={styles.diaCorda} viewBox="0 0 64 16" aria-hidden="true"><path d="M0 8 Q 8 2 16 8 T 32 8 T 48 8 T 64 8" /></svg>
          </p>
        ) : (
          <>
            {plays && dia.last && (
              <p className={styles.diaConta}>
                de ontem pra cá · <b>{plays}</b> · a última às <b>{dia.last.time}</b>, {dia.last.track}
              </p>
            )}
            {!plays && dia.last && (
              <p className={styles.diaConta}>
                nada tocou nas últimas 24 horas · a última foi <b>{dia.last.day}, {dia.last.time}</b>, {dia.last.track}
              </p>
            )}
          </>
        )}
      </div>
      {dia.capas.length > 0 && (
        <ol className={styles.diaFita} aria-label="O que tocou por último">
          {dia.capas.map((capa) => (
            <li key={capa.key} title={capa.caption}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={capa.coverUrl} alt={capa.caption} loading="lazy" />
            </li>
          ))}
        </ol>
      )}
    </header>
  );
}
