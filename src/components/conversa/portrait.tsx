"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { privateFetch } from "@/lib/http/private-fetch";
import { Fala } from "@/components/amigo/fala";
import type { PortraitService } from "@/modules/conversation/application/portrait-service";
import styles from "../descobertas/discovery-memory.module.css";
type Data = Awaited<ReturnType<PortraitService["load"]>>;
const count = (n: number) => n.toLocaleString("pt-BR");
export function Portrait() {
  const [data, setData] = useState<Data | null>(null); const [topics, setTopics] = useState<Array<{ key: string; headline: string }>>([]);
  const [error, setError] = useState(false); const [attempt, setAttempt] = useState(0); const [restoring, setRestoring] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); setError(false);
    void Promise.all([privateFetch("/api/portrait", { signal: controller.signal }), privateFetch("/api/editorial", { signal: controller.signal })])
      .then(async ([portrait, editorial]) => { if (!portrait.ok || !editorial.ok) throw new Error("portrait");
        const [report, memory] = await Promise.all([portrait.json(), editorial.json()]);
        if (!controller.signal.aborted) { setData(report); setTopics(memory.topics); }
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt]);
  const restore = async (key: string) => {
    if (restoring) return; setRestoring(true);
    try { const response = await privateFetch("/api/editorial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, action: "RESTORE" }) });
      if (!response.ok) throw new Error("restore"); setTopics((rows) => rows.filter((row) => row.key !== key));
    } catch { setError(true); } finally { setRestoring(false); }
  };
  return <div className={styles.memory}>
    <Fala level={1} headline="O que permanece no teu fone." narrative="Dá pra olhar teu histórico por dois caminhos: quem aparece ao longo dele e quem está mais presente agora." />
    <nav><Link href="/overview">voltar à conversa →</Link><Link href="/history">abrir histórico de reprodução →</Link><Link href="/discovery/memory">tuas descobertas e respostas →</Link></nav>
    {error && <p role="alert">Não consegui atualizar o retrato ou guardar tua escolha. <button onClick={() => setAttempt((v) => v + 1)}>tentar novamente</button></p>}
    {!data && !error && <p role="status">Reunindo o que ficou…</p>}
    {data && <>
      {!data.total ? <p>Ainda não há reproduções importadas para formar teu retrato. <Link href="/settings">conectar teu histórico →</Link></p> : <>
        <p className={styles.note}>{count(data.total)} reproduções no histórico importado. Retrato reunido em {new Date(data.asOf).toLocaleString("pt-BR", { timeZone: data.timezone })}.</p>
        <section className={styles.session}><h2>Quem aparece ao longo do caminho</h2>
          <p className={styles.note}>Os vinte artistas com mais reproduções. Dias observados são contados no fuso {data.timezone}.</p>
          <ol className={styles.tracks}>{data.artists.map((artist) => <li key={artist.name}><h3>{artist.name}</h3><p>{count(artist.plays)} reproduções em {count(artist.days)} dias distintos.</p>
            <Link href={`/history?search=${encodeURIComponent(artist.name)}`}>ver reproduções →</Link></li>)}</ol>
        </section>
        <section className={styles.session}><h2>A fase recente, ao lado do retrato</h2>
          <p className={styles.note}>Reproduções registradas nos últimos 30 dias, comparadas às dos 30 anteriores.</p>
          <ol className={styles.tracks}>{data.changes.map((artist) => <li key={artist.name}><h3>{artist.name}</h3><p>{count(artist.current)} agora · {count(artist.previous)} no período anterior.</p></li>)}</ol>
        </section>
      </>}
      <section className={styles.session}><h2>Assuntos que você silenciou</h2><p className={styles.note}>Isso muda a conversa, sem alterar teu gosto ou as avaliações de músicas. A escolha acompanha tua conta.</p>
        {!topics.length ? <p>Nenhum assunto silenciado.</p> : <ul>{topics.map((topic) => <li key={topic.key}><p>{topic.headline}</p><button disabled={restoring} onClick={() => void restore(topic.key)}>voltar a esse assunto</button></li>)}</ul>}
      </section>
    </>}
  </div>;
}
