"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Capa } from "@/components/amigo/fala";
import { privateFetch } from "@/lib/http/private-fetch";
import { useSelection } from "./selection-provider";
import styles from "./discovery-recall.module.css";

interface Summary {
  latest: {
    id: string;
    currentRank: number | null;
    total: number;
    current: { artistName: string; trackName: string; albumName?: string | null; coverUrl?: string | null } | null;
  } | null;
}

/** Quantas faixas separadas a retomada nomeia antes de dizer só quantas faltam. */
const NAMED = 3;

export interface Recall {
  status: "loading" | "error" | "ready";
  retry: () => void;
  latest: Summary["latest"];
  /** Onde abrir a busca: a sessão guardada, quando há uma. */
  resumeHref: string | null;
  saved: Array<{ id: string; trackName: string; artistName: string }>;
  /** Nada guardado: a retomada não ocupa lugar. */
  empty: boolean;
}

/**
 * O estado observado da descoberta (última sessão e o que ficou separado),
 * sem texto de IA. Quem mostra a retomada e quem oferece as respostas leem
 * o mesmo estado, para não buscar duas vezes.
 */
export function useDiscoveryRecall(enabled = true): Recall {
  const selection = useSelection();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setError(false);
    void privateFetch("/api/discovery-memory?summary=1", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("summary");
        const data = await response.json();
        if (!controller.signal.aborted) setSummary(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [attempt, enabled]);

  const saved = selection.ready && !selection.error ? selection.items : [];
  const latest = summary?.latest ?? null;
  return {
    status: error ? "error" : summary ? "ready" : "loading",
    retry: () => setAttempt((value) => value + 1),
    latest,
    resumeHref: latest ? `/discovery?session=${encodeURIComponent(latest.id)}` : null,
    saved,
    empty: !latest && saved.length === 0,
  };
}

/** "indicação 3 de 12", só quando a posição guardada ainda cabe na lista. */
function progressOf(latest: NonNullable<Summary["latest"]>) {
  const { currentRank, total } = latest;
  if (!currentRank || total <= 0 || currentRank > total) return null;
  return { rank: currentRank, total, ratio: currentRank / total };
}

/**
 * A retomada, no fim da conversa: onde a última busca parou (com a capa) e
 * o que ficou separado, com nome. Só estado observado, na mesma hierarquia
 * das provas do fio.
 */
export function DiscoveryRecall({ recall: shared }: { recall?: Recall }) {
  const own = useDiscoveryRecall(!shared);
  const recall = shared ?? own;

  if (recall.status === "error") {
    return (
      <aside className={styles.recall} data-quiet="true" aria-label="Continuar descobertas">
        <p className={styles.failed}>
          Não consegui recuperar teus caminhos agora. <button type="button" onClick={recall.retry}>tentar novamente</button>
        </p>
        <Link className={styles.more} href="/discovery">abrir a descoberta →</Link>
      </aside>
    );
  }
  if (recall.status !== "ready" || recall.empty) return null;

  const { latest, resumeHref, saved } = recall;
  const current = latest?.current ?? null;
  const progress = latest ? progressOf(latest) : null;
  const rest = saved.length - NAMED;

  return (
    <aside className={styles.recall} aria-label="Continuar descobertas" data-solo={!latest || saved.length === 0 || undefined}>
      {latest && resumeHref && (
        <section className={styles.part}>
          <h3 className={styles.label}>Tua última busca parou aqui</h3>
          <Link className={styles.resume} href={resumeHref}>
            {current && (
              <Capa
                className={styles.cover}
                cover={{ url: current.coverUrl, title: current.albumName ?? current.trackName, artist: current.artistName }}
                label={false}
              />
            )}
            <span className={styles.where}>
              {current ? (
                <>
                  <strong>{current.trackName}</strong>
                  <span>{current.artistName}</span>
                </>
              ) : (
                <strong>Teu último caminho continua guardado.</strong>
              )}
              {progress && (
                <span className={styles.progress}>
                  <i aria-hidden="true"><b style={{ width: `${Math.round(progress.ratio * 100)}%` }} /></i>
                  indicação {progress.rank} de {progress.total}
                </span>
              )}
              <span className={styles.more}>retomar esse caminho →</span>
            </span>
          </Link>
        </section>
      )}

      {saved.length > 0 && (
        <section className={styles.part}>
          <h3 className={styles.label}>
            {saved.length === 1 ? "1 faixa separada pra depois" : `${saved.length} faixas separadas pra depois`}
          </h3>
          <ol className={styles.saved}>
            {saved.slice(-NAMED).reverse().map((item) => (
              <li key={item.id}>
                <strong>{item.trackName}</strong>
                <span>{item.artistName}</span>
              </li>
            ))}
          </ol>
          <Link className={styles.more} href="/discovery/collection">
            {rest > 0 ? `ver essas e mais ${rest} →` : "ver o que ficou pra depois →"}
          </Link>
        </section>
      )}
    </aside>
  );
}
