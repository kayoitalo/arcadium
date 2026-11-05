"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { privateFetch } from "@/lib/http/private-fetch";
import { useSelection } from "./selection-provider";
import styles from "./discovery-memory.module.css";

interface Summary { latest: { id: string; currentRank: number | null; total: number; current: { artistName: string; trackName: string } | null } | null }
/** Observed session/collection state, separate from cached AI narratives. */
export function DiscoveryRecall() {
  const selection = useSelection(); const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState(false); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setError(false);
    void privateFetch("/api/discovery-memory?summary=1", { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("summary"); const data = await response.json(); if (!controller.signal.aborted) setSummary(data);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt]);
  if (error) return <aside className={styles.recall}><p>Não consegui recuperar teus caminhos agora. <button onClick={() => setAttempt((value) => value + 1)}>tentar novamente</button></p><Link href="/discovery">abrir a descoberta →</Link></aside>;
  if (!summary || (!summary.latest && !selection.items.length)) return null;
  return <aside className={styles.recall} aria-label="Continuar descobertas">
    <div>
    {summary.latest?.current ? <p>Tua última busca ficou em <strong>“{summary.latest.current.trackName}”</strong>, de {summary.latest.current.artistName}.</p>
      : summary.latest && <p>Teu último caminho continua guardado.</p>}
    {selection.ready && !selection.error && selection.items.length > 0 && <p>Você tem {selection.items.length} {selection.items.length === 1 ? "faixa separada" : "faixas separadas"} para depois.</p>}
    <nav>{summary.latest && <Link href={`/discovery?session=${encodeURIComponent(summary.latest.id)}`}>retomar esse caminho →</Link>}
      <Link href="/discovery/collection">minha coleção →</Link><Link href="/discovery/memory">caminhos e respostas →</Link></nav>
    </div>{selection.ready && !selection.error && selection.items.length > 0 && <div className={styles.recallCount} aria-hidden="true">{String(selection.items.length).padStart(2,"0")}<small>para depois</small></div>}
  </aside>;
}
