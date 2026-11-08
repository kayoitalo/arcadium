"use client";
import { useEffect, useState } from "react";
import { privateFetch } from "@/lib/http/private-fetch";
import { listeningCuesSchema, type ListeningCues as Cues } from "@/modules/recommendations/domain/listening-cues";
import styles from "./album-journeys.module.css";
export function ListeningCueExcerpt({ value }: { value: Cues }) {
  return <>
    {value.status === "INSUFFICIENT_EVIDENCE" && <p>Não tenho uma pista confiável pra essa versão. Ouve e me conta o que percebeu.</p>}
    {value.cues.map((cue) => <article className={styles.context} key={cue.kind}><p><strong>{cue.fact}</strong></p><p>{cue.invitation}</p>
      {cue.kind === "RECORDING_CREDIT"
        ? <p><a href={cue.source.url} target="_blank" rel="noreferrer">Crédito da gravação na Universal Music Brasil ↗</a> · consultado em <time dateTime={cue.source.checkedOn}>{cue.source.checkedOn.split("-").reverse().join("/")}</time></p>
        : <p><a href={cue.source.url} target="_blank" rel="noreferrer">{cue.kind === "WEEKLY_RECORDING_CREDIT" ? "Crédito da gravação no MusicBrainz ↗" : "Entrada da faixa no Apple Music ↗"}</a> · consultado em <time dateTime={cue.source.fetchedAt}>{new Date(cue.source.fetchedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</time></p>}
    </article>)}
  </>;
}
/** Montado só quando a aba "o que reparar" abre: os créditos são conferidos aí. */
export function ListeningCues({ itemId, mediaReady }: { itemId: string; mediaReady: boolean }) {
  const [value, setValue] = useState<Cues | null>(null);
  const [error, setError] = useState(false); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setValue(null); setError(false);
    void privateFetch("/api/listening-cues", { method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId }) })
      .then(async (response) => { if (!response.ok) throw new Error(); const data = listeningCuesSchema.parse(await response.json()); if (!controller.signal.aborted) setValue(data); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [itemId, mediaReady, attempt]);
  return <div className={styles.contextDisclosure}>
    {!value && !error && <p role="status">Conferindo os créditos dessa versão…</p>}
    {error && <p role="alert">Não consegui conferir agora. <button onClick={() => setAttempt((n) => n + 1)}>tenta de novo</button></p>}
    {value && <ListeningCueExcerpt value={value} />}
  </div>;
}
