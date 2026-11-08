"use client";
import { useState } from "react";
import { privateFetch } from "@/lib/http/private-fetch";
import { Resposta, Respostas } from "@/components/amigo/fala";
import styles from "./ajustes.module.css";
interface Report {
  sessions: { status: string; _count: { id: number } }[];
  responses: { type: string; _count: { id: number } }[];
  attempts: { model: string | null; status: string; kind: string; _count: { id: number; tokenCount: number }; _sum: { tokenCount: number | null } }[];
  budget: { usedToday: number; usedThisHour: number; dailyLimit: number; hourlyLimit: number };
}
export function DiscoveryHealth() {
  const [data, setData] = useState<Report | null>(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const load = async () => { if (busy) return; setBusy(true); setError(false);
    try { const response = await privateFetch("/api/discovery-health"); if (!response.ok) throw new Error(); setData(await response.json()); }
    catch { setError(true); } finally { setBusy(false); }
  };
  const searches = data ? data.sessions.reduce((sum, row) => sum + row._count.id, 0) : 0;
  const failed = data?.sessions.find((row) => row.status === "FAILED")?._count.id ?? 0;
  const answers = data ? data.responses.reduce((sum, row) => sum + row._count.id, 0) : 0;
  const plural = (value: number, one: string, many: string) => `${value.toLocaleString("pt-BR")} ${value === 1 ? one : many}`;
  // na frente, a voz dele; modelo, status e tokens ficam no registro técnico, recolhido
  return <section className={styles.section}><h2 className={styles.title}>as descobertas desta semana</h2>
    <p className={styles.hint}>Quantas buscas eu fiz nos últimos sete dias e quantas deram errado. Não é nota das descobertas: tuas respostas contam revisões.</p>
    <Respostas inline><Resposta disabled={busy} onClick={() => void load()}>{busy ? "conferindo…" : data ? "conferir de novo" : "como foi a semana?"}</Resposta></Respostas>
    {error && <p role="alert">Não consegui conferir agora. Tenta de novo daqui a pouco.</p>}
    {data && <>
      <p className={styles.sample}>{plural(searches, "busca", "buscas")} nos últimos sete dias{failed > 0 ? `, ${plural(failed, "não deu certo", "não deram certo")}` : ", todas deram certo"}. {plural(answers, "resposta tua", "respostas tuas")}.</p>
      <p className={styles.hint}>Nesta hora ainda posso escrever {Math.max(0, data.budget.hourlyLimit - data.budget.usedThisHour)} {data.budget.hourlyLimit - data.budget.usedThisHour === 1 ? "vez" : "vezes"}; hoje, {Math.max(0, data.budget.dailyLimit - data.budget.usedToday)}.</p>
      <details className={styles.technical}><summary>registro técnico</summary>
        <p>Cota local da conta: {data.budget.usedThisHour}/{data.budget.hourlyLimit} na última hora e {data.budget.usedToday}/{data.budget.dailyLimit} nas últimas 24 horas. Não é uma leitura da cota global do provedor.</p>
        <ul>{data.attempts.map((row) => <li key={`${row.kind}:${row.model}:${row.status}`}>{row.model ?? "modelo não informado"} · {row.kind === "ATTEMPT" ? "tentativa do provedor" : "registro legado"} · {row.status} · {row._count.id} registros · {row._sum.tokenCount ?? "sem medição de"} tokens{row._count.tokenCount < row._count.id ? " (medição parcial ou ausente)" : ""}</li>)}</ul>
      </details>
    </>}
  </section>;
}
