"use client";
import { useEffect, useState } from "react";
import { privateFetch } from "@/lib/http/private-fetch";
import { culturalContextSchema, type ContextKind, type CulturalContext } from "@/modules/recommendations/domain/cultural-context";
import { DiscoveryDisclosure } from "./discovery-disclosure";
import styles from "./album-journeys.module.css";

export function ContextExcerpt({ value }: { value: CulturalContext }) {
  return <div className={styles.context}>
    {value.status === "AVAILABLE" ? <>
      <blockquote>{value.text}</blockquote>
      <p><a href={value.sourceUrl} target="_blank" rel="noreferrer">Trecho da wiki do Last.fm ↗</a> · consultado em <time dateTime={value.fetchedAt}>{new Date(value.fetchedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time></p>
    </> : <p>{value.reason === "NOT_CONFIGURED" ? "A fonte de contexto não está configurada neste ambiente." : value.reason === "IDENTITY_MISMATCH"
      ? "O nome devolvido pela fonte não confirmou esta referência. Preferi deixar o espaço em aberto." : "Não encontrei um texto com fonte para esta referência."}</p>}
    <p>{value.kind === "album" ? "Este contexto trata do álbum. A edição e suas gravações são identificadas separadamente no catálogo." : "Este contexto trata da música pelo nome. A fonte não confirma a gravação específica desta prévia."}</p>
  </div>;
}
export function TrackContext({ itemId, albumName }: { itemId: string; albumName: string | null }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ContextKind>(albumName ? "album" : "track");
  const [value, setValue] = useState<CulturalContext | null>(null); const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController(); setValue(null); setError(null);
    void privateFetch("/api/discovery-context", { method: "POST", headers: { "Content-Type": "application/json" },
      signal: controller.signal, body: JSON.stringify({ itemId, kind }) }).then(async (response) => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error ?? "Não consegui consultar a fonte.");
      const parsed = culturalContextSchema.parse(data); if (!controller.signal.aborted) setValue(parsed);
    }).catch((err) => { if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Não consegui consultar a fonte."); });
    return () => controller.abort();
  }, [itemId, kind, open, attempt]);
  return <DiscoveryDisclosure className={styles.contextDisclosure} summary="um pouco de contexto, com fonte" open={open} onOpenChange={setOpen}>
    {albumName && <nav aria-label="Assunto do contexto">{(["album", "track"] as const).map((option) => <button key={option} aria-pressed={kind === option} onClick={() => setKind(option)}>{option === "album" ? "sobre o álbum" : "sobre a música"}</button>)}</nav>}
    {!value && !error && <p role="status">Consultando a referência…</p>}
    {error && <p role="alert">{error} <button onClick={() => setAttempt((n) => n + 1)}>tentar novamente</button></p>}
    {value?.kind === kind && <ContextExcerpt value={value} />}
  </DiscoveryDisclosure>;
}
