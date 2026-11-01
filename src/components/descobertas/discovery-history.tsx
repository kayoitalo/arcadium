"use client";
import { useEffect, useState } from "react";
import { privateFetch } from "@/lib/http/private-fetch";
import type { DiscoveryContext, DiscoveryIntent } from "@/modules/recommendations/domain/discovery-intent";
import { intentionLabel } from "./discovery-view";
import styles from "./descobertas.module.css";

export interface JourneySession {
  sessionId: string; createdAt: string; currentRank: number | null; total: number;
  intent: DiscoveryIntent | null;
  journey: (DiscoveryContext["journey"] & { rootSessionId: string }) | null;
  firstTrack: { artistName: string; trackName: string } | null;
}
export function groupJourneys(sessions: JourneySession[]) {
  const groups = new Map<string, JourneySession[]>();
  for (const session of sessions) {
    const root = session.journey?.rootSessionId ?? session.sessionId;
    groups.set(root, [...(groups.get(root) ?? []), session]);
  }
  return [...groups].map(([root, steps]) => ({ root,
    steps: steps.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.sessionId.localeCompare(b.sessionId)) }));
}

export function DiscoveryJourneyList({ sessions, currentSessionId, busy, onResume }: {
  sessions: JourneySession[]; currentSessionId: string | null; busy: boolean; onResume: (sessionId: string) => void;
}) {
  return <>{groupJourneys(sessions).map(({ root, steps }) => <section key={root} className={styles.journeyGroup}>
    <h2>{steps.some((step) => step.sessionId === root) ? "Um caminho teu" : "Trecho recente de um caminho"}</h2>
    <ol>{steps.map((step) => <li key={step.sessionId}>
      <div><strong>{intentionLabel(step.intent)}</strong>
        <p>{step.journey?.anchor ? `A partir de “${step.journey.anchor.trackName}”, de ${step.journey.anchor.artistName}`
          : step.firstTrack ? `${step.firstTrack.trackName} · ${step.firstTrack.artistName}` : "Esta busca ficou sem indicações."}</p>
        <small>{new Date(step.createdAt).toLocaleDateString("pt-BR")} · {step.total} indicações
          {step.currentRank != null && step.currentRank <= step.total ? ` · posição ${step.currentRank}` : ""}</small>
      </div>
      <button className={styles.textButton} disabled={busy} onClick={() => onResume(step.sessionId)}>
        {currentSessionId === step.sessionId ? "continuar →" : "retomar →"}
      </button>
    </li>)}</ol>
  </section>)}</>;
}

export function DiscoveryHistory({ currentSessionId, busy, onResume }: {
  currentSessionId: string | null; busy: boolean; onResume: (sessionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<JourneySession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true); setError(false);
    void privateFetch("/api/recommendations?history=1", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("history");
        const data = await response.json();
        if (!controller.signal.aborted) setSessions(data.sessions ?? []);
      }).catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open, currentSessionId, attempt]);
  return <details className={styles.collection} open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary><span>Caminhos anteriores</span><span aria-hidden="true">↘</span></summary>
    <div>
      <p className={styles.mapNote}>As vinte buscas mais recentes, reunidas por caminho. Retomar mantém teu lugar e tuas respostas.</p>
      {loading ? <p role="status" className={styles.quiet}>Recuperando os caminhos…</p>
        : error ? <p role="alert">Não consegui recuperar os caminhos. <button className={styles.textButton} onClick={() => setAttempt((value) => value + 1)}>tentar novamente</button></p>
        : !sessions.length ? <p className={styles.quiet}>Teus caminhos aparecem aqui depois da primeira busca.</p>
        : <DiscoveryJourneyList sessions={sessions} currentSessionId={currentSessionId} busy={busy} onResume={onResume} />}
    </div>
  </details>;
}
