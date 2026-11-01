"use client";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { privateFetch } from "@/lib/http/private-fetch";
import type { DiscoveryContext, DiscoveryIntent } from "@/modules/recommendations/domain/discovery-intent";
import { intentionLabel } from "./discovery-view";
import { DiscoveryDisclosure } from "./discovery-disclosure";
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

export function DiscoveryJourneyList({ sessions, currentSessionId, currentRank, busy, onResume, animateEntrance = false }: {
  sessions: JourneySession[]; currentSessionId: string | null; currentRank?: number; busy: boolean; onResume: (sessionId: string) => void;
  animateEntrance?: boolean;
}) {
  const reduced = Boolean(useReducedMotion());
  return <>{groupJourneys(sessions).map(({ root, steps }, index) => <motion.section key={root} className={styles.journeyGroup}
    initial={animateEntrance && !reduced ? { opacity: 0 } : false} animate={{ opacity: 1 }}
    transition={{ duration: reduced ? 0 : 0.12, delay: reduced ? 0 : Math.min(index, 3) * 0.025 }}>
    <h2>{steps.some((step) => step.sessionId === root) ? "Um caminho teu" : "Trecho recente de um caminho"}</h2>
    <ol>{steps.map((step) => {
      const active = currentSessionId === step.sessionId;
      const rank = active && currentRank != null ? currentRank : step.currentRank;
      return <li key={step.sessionId} aria-current={active ? "step" : undefined}>
      <div><strong>{intentionLabel(step.intent)}</strong>
        <p>{step.journey?.anchor ? `A partir de “${step.journey.anchor.trackName}”, de ${step.journey.anchor.artistName}`
          : step.firstTrack ? `${step.firstTrack.trackName} · ${step.firstTrack.artistName}` : "Esta busca ficou sem indicações."}</p>
        <small>{new Date(step.createdAt).toLocaleDateString("pt-BR")} · {step.total} indicações
          {rank != null && rank <= step.total ? ` · posição ${rank}` : rank != null && step.total > 0 ? " · chegou ao fim" : ""}
          {active && <span className={styles.currentPath}> · você está aqui</span>}</small>
      </div>
      <button className={styles.textButton} disabled={busy} onClick={() => onResume(step.sessionId)}>
        {active ? "continuar →" : "retomar →"}
      </button>
    </li>; })}</ol>
  </motion.section>)}</>;
}

export function DiscoveryHistory({ currentSessionId, currentRank, busy, onResume }: {
  currentSessionId: string | null; currentRank: number; busy: boolean; onResume: (sessionId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<JourneySession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [presented, setPresented] = useState(false);
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
  useEffect(() => { if (open && sessions.length && !loading) setPresented(true); }, [open, sessions.length, loading]);
  return <DiscoveryDisclosure className={styles.collection} bodyClassName={styles.disclosureContent} open={open} onOpenChange={setOpen}
    summary={<><span>Caminhos anteriores</span><span aria-hidden="true">↘</span></>}>
      <p className={styles.mapNote}>As vinte buscas mais recentes, reunidas por caminho. Retomar mantém teu lugar e tuas respostas.</p>
      {loading && <p role="status" className={styles.quiet}>Recuperando os caminhos…</p>}
      {error && <p role="alert">Não consegui atualizar os caminhos. <button className={styles.textButton} onClick={() => setAttempt((value) => value + 1)}>tentar novamente</button></p>}
      {!loading && !error && !sessions.length && <p className={styles.quiet}>Teus caminhos aparecem aqui depois da primeira busca.</p>}
      {sessions.length > 0 && <DiscoveryJourneyList sessions={sessions} currentSessionId={currentSessionId} currentRank={currentRank}
        busy={busy || loading || error} onResume={onResume} animateEntrance={!presented} />}
  </DiscoveryDisclosure>;
}
