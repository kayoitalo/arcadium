"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { privateFetch } from "@/lib/http/private-fetch";
import { Fala, PenLayer } from "@/components/amigo/fala";
import { usePen } from "@/components/amigo/use-pen";
import { band, circle } from "@/components/amigo/gestures";
import { textLines } from "@/components/amigo/measure";
import { useReducedMotion } from "framer-motion";
import { MEMORY_LABEL, type MemoryPage } from "@/modules/recommendations/domain/discovery-memory";
import { intentionLabel } from "./discovery-view";
import type { DiscoveryIntent } from "@/modules/recommendations/domain/discovery-intent";
import { DiscoveryDisclosure } from "./discovery-disclosure";
import styles from "./discovery-memory.module.css";
import { MemoryTools } from "./memory-tools";
import { EditionCredit } from "./album-journeys";
import { ContextExcerpt } from "./track-context";
import { ListeningCueExcerpt } from "./listening-cues";
import { ListeningNote } from "@/components/amigo/listening-note";

const when = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const aspects: Record<string, string> = { VOCALS: "vocal", INSTRUMENTAL: "instrumental", LYRICS: "letra", RHYTHM: "ritmo", ATMOSPHERE: "atmosfera", OTHER: "outro" };
function aspectText(details: unknown) {
  const values = details && typeof details === "object" && "aspects" in details ? details.aspects : null;
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string" && Boolean(aspects[value])).map((value) => aspects[value]).join(", ") : "";
}
export function DiscoveryMemory() {
  const [draft, setDraft] = useState(""); const [query, setQuery] = useState(""); const [onlyResponses, setOnlyResponses] = useState(false);
  const [cursors, setCursors] = useState<string[]>([]); const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState<MemoryPage | null>(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(false);
  const cursor = cursors.at(-1);
  const params = new URLSearchParams({ q: query, responses: onlyResponses ? "1" : "0", ...(cursor ? { cursor } : {}) });
  const url = `/api/discovery-memory?${params}`;
  const stage = useRef<HTMLDivElement>(null); const mark = useRef<HTMLSpanElement>(null); const heading = useRef<HTMLHeadingElement>(null);
  const focusResults = useRef(false);
  const [activeChapter,setActiveChapter]=useState<string|null>(null);const chapters=useRef(new Map<string,HTMLHeadingElement>());
  const reduced = Boolean(useReducedMotion()); const signal = useRef(null);
  const pen = usePen(stage, (origin) => {
    if (!mark.current) return null;
    const { lines, size } = textLines(mark.current, origin); const { strokes, width } = band(lines, size);
    const gestures: import("@/components/amigo/trace").TraceGesture[]=[{ id: "memory-title", layer: "under", strokes, width, cap: "butt" }];
    const target=activeChapter?chapters.current.get(activeChapter):null;
    if(target){const rows=textLines(target,origin).lines;if(rows.length){const left=Math.min(...rows.map(row=>row.left));const right=Math.max(...rows.map(row=>row.right));const top=rows[0].capTop;const bottom=rows.at(-1)!.baseline;
      gestures.push({id:"memory-chapter:"+activeChapter,layer:"over",strokes:[circle({left,top,width:right-left,height:bottom-top},activeChapter!,8)],width:1.8,cap:"round"});}}
    return { gestures, notes: [], wave: null };
  }, "memory:"+activeChapter, {settle:220});
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(false); setPage(null); setActiveChapter(null);
    void privateFetch(url, { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error("memory"); const data = await response.json();
      if (!controller.signal.aborted) setPage(data);
    }).catch(() => { if (!controller.signal.aborted) setError(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [url, attempt]);
  useEffect(() => {
    if (!page || !focusResults.current) return;
    focusResults.current = false;
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
  }, [page, reduced]);
  return <div ref={stage} className={styles.memory}>
    <header><p className={styles.eyebrow}>teus caminhos · horários de Brasília</p>
      <Fala level={1} headline="O que ficou pelo caminho." mark={["pelo caminho"]} markRef={mark} marked={pen.started.has("memory-title")}
        narrative="As buscas, as indicações e o que você contou de cada uma. Retomar mantém teu lugar; uma resposta pode ser revista na própria faixa." />
      <nav><Link href="/discovery">voltar à descoberta →</Link><Link href="/discovery/collection">abrir minha coleção →</Link></nav>
      <ListeningNote label="guardei o fio"><p>Tem caminho que merece uma segunda volta. Aqui ficam as indicações e o que você me contou, no momento em que aconteceu.</p></ListeningNote>
    </header>
    <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); focusResults.current = true; setCursors([]); setQuery(draft.trim()); setAttempt((value) => value + 1); }}>
      <label>Artista ou faixa<input maxLength={120} value={draft} onChange={(event) => { focusResults.current = false; setDraft(event.target.value); }} /></label>
      <button type="submit" disabled={loading}>procurar</button>
      <label className={styles.check}><input type="checkbox" checked={onlyResponses} onChange={(event) => { focusResults.current = false; setOnlyResponses(event.target.checked); setCursors([]); }} /> só buscas com respostas registradas</label>
    </form>
    <h2 ref={heading} tabIndex={-1} className={styles.resultTitle}>Memória das descobertas{query ? ` · ${query}` : ""}</h2>
    <p className={styles.note}>Os registros abaixo contam o que você respondeu em cada momento. Uma resposta posterior pode ter revisto a anterior. Ver uma indicação não significa ter ouvido a música.</p>
    {loading && <p role="status">Recuperando os caminhos…</p>}
    {error && <p role="alert">Não consegui abrir este recorte. <button onClick={() => setAttempt((value) => value + 1)}>tentar novamente</button></p>}
    {page && <>
      {!page.sessions.length && <p>Nenhuma busca encontrada neste recorte. Você pode ampliar a procura ou voltar à descoberta.</p>}
      {page.sessions.map((session, index) => <section className={styles.session} key={session.id}>
        <div className={styles.chapter} aria-hidden="true"><span>caminho</span><strong>{String(index+1).padStart(2,"0")}</strong><i /></div><div className={styles.sessionSheet}>
        <div className={styles.sessionHeading}><div><p className={styles.eyebrow}>{when(session.createdAt)}</p><h2 ref={(node)=>{if(node)chapters.current.set(session.id,node);else chapters.current.delete(session.id);}}>{intentionLabel(session.intent as DiscoveryIntent | null)}</h2>
          <p>{session.album ? `${session.album.albumName} · ${session.album.artistName}` : session.anchor ? `A partir de “${session.anchor.trackName}”, de ${session.anchor.artistName}.` : "Um passo do teu caminho."}</p>
          {session.album && <EditionCredit album={session.album} />}
          <p className={styles.note}>{session.total} {session.total === 1 ? "indicação" : "indicações"}{session.items.length < session.total ? ` · ${session.items.length} neste recorte` : ""}{session.currentRank != null ? ` · ${session.currentRank <= session.total ? `posição ${session.currentRank}` : "chegou ao fim"}` : ""}</p></div>
          <Link href={`/discovery?session=${encodeURIComponent(session.id)}`}>retomar e revisar →</Link></div>
        {session.exports?.map((event, index) => <p className={styles.note} key={index}>Exportação registrada em {when(event.createdAt)} · {event.resolvedCount} de {event.totalItems} faixas resolvidas.</p>)}
        <DiscoveryDisclosure className={styles.details} summary="indicações e respostas" onOpenChange={(open)=>setActiveChapter(current=>open?session.id:current===session.id?null:current)}>
          <ol className={styles.tracks}>{session.items.map((item) => <li key={item.id}>
            <h3>{item.trackName}</h3><p>{item.artistName}</p>
            {item.reason && <p className={styles.note}>{item.reason}</p>}
            {item.listeningCues && <DiscoveryDisclosure className={styles.details} summary="pistas desta versão, com fonte"><ListeningCueExcerpt value={item.listeningCues} /></DiscoveryDisclosure>}
            {Object.values(item.culturalContext ?? {}).map((value) => value && <DiscoveryDisclosure key={value.kind} className={styles.details} summary={`contexto consultado · ${value.kind === "album" ? "álbum" : "música"}`}><ContextExcerpt value={value} /></DiscoveryDisclosure>)}
            <p className={styles.note}>{item.exposedAt ? `Indicação vista em ${when(item.exposedAt)}.` : "Sem registro de exposição."}</p>
            {item.starts?.map((event, index) => <p className={styles.note} key={index}>Prévia iniciada no player em {when(event.createdAt)}. Isso não indica escuta completa.</p>)}
            {item.feedback.length ? <ol className={styles.responses}>{item.feedback.map((entry) => <li key={entry.id}>
              <p><time dateTime={entry.createdAt}>{when(entry.createdAt)}</time> · {MEMORY_LABEL[entry.type] ?? "resposta anterior"}{entry.revisesId ? " · revisão" : ""}</p>
              {entry.note && <blockquote>{entry.note}</blockquote>}
              {aspectText(entry.details) && <p className={styles.note}>Você destacou: {aspectText(entry.details)}.</p>}
            </li>)}</ol> : <p className={styles.note}>Nenhuma resposta registrada.</p>}
            {item.moreFeedback && <p className={styles.note}>Há respostas anteriores fora deste recorte. Retome a sessão para revisar a avaliação atual.</p>}
          </li>)}</ol>
        </DiscoveryDisclosure>
      </div></section>)}
      <nav className={styles.pagination}>
        <button disabled={loading || !cursors.length} onClick={() => { focusResults.current = true; setCursors((values) => values.slice(0, -1)); }}>← mais recentes</button>
        <a href={`${url}&download=1`}>baixar este recorte (JSON)</a>
        <button disabled={loading || !page.nextCursor} onClick={() => { if (page.nextCursor) { focusResults.current = true; setCursors((values) => [...values, page.nextCursor!]); } }}>mais antigas →</button>
      </nav>
      <p className={styles.note}>Cada página traz até {page.limits.sessions} buscas, {page.limits.itemsPerSession} indicações por busca e {page.limits.feedbackPerItem} respostas recentes por indicação. O arquivo inclui só este recorte e a referência à próxima página.</p>
      <p className={styles.note}>Por indicação, até dez inícios de prévia; por busca, até cinco exportações. A exportação completa abaixo percorre todos os registros disponíveis. Eventos de prévia anteriores à implantação não são reconstruídos.</p>
    </>}
    {error && cursors.length > 0 && <button onClick={() => setCursors((values) => values.slice(0, -1))}>voltar à página anterior</button>}
    <MemoryTools />
    <PenLayer pen={pen} signal={signal} reduced={reduced} />
  </div>;
}
