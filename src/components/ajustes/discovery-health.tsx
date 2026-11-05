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
  return <section className={styles.section}><h2 className={styles.title}>Como as descobertas estão funcionando</h2><p className={styles.hint}>Um recorte dos últimos sete dias. Contagens de respostas incluem revisões; não são uma taxa de aprovação nem uma prova de qualidade musical.</p>
    <Respostas inline><Resposta disabled={busy} onClick={() => void load()}>{busy ? "reunindo registros…" : "consultar funcionamento"}</Resposta></Respostas>
    {error && <p role="alert">Não consegui atualizar os registros. Tente novamente.</p>}
    {data && <><p>Cota local da conta: {data.budget.usedThisHour}/{data.budget.hourlyLimit} na última hora e {data.budget.usedToday}/{data.budget.dailyLimit} nas últimas 24 horas. Não é uma leitura da cota global do provedor.</p>
      <p>{data.sessions.reduce((sum, row) => sum + row._count.id, 0)} buscas registradas; {data.sessions.find((row) => row.status === "FAILED")?._count.id ?? 0} falharam. {data.responses.reduce((sum, row) => sum + row._count.id, 0)} registros de resposta.</p>
      <ul>{data.attempts.map((row) => <li key={`${row.kind}:${row.model}:${row.status}`}>{row.model ?? "modelo não informado"} · {row.kind === "ATTEMPT" ? "tentativa do provedor" : "registro legado"} · {row.status} · {row._count.id} registros · {row._sum.tokenCount ?? "sem medição de"} tokens{row._count.tokenCount < row._count.id ? " (medição parcial ou ausente)" : ""}</li>)}</ul></>}
  </section>;
}
