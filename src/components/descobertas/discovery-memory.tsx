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
import { EditionCredit, EditorialCredit } from "./album-journeys";
import { ContextExcerpt } from "./track-context";
import { ListeningCueExcerpt } from "./listening-cues";
import { WeeklyHistory } from "./weekly-discovery";

const when = (value: string) => new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
const aspects: Record<string, string> = { VOCALS: "vocal", INSTRUMENTAL: "instrumental", LYRICS: "letra", RHYTHM: "ritmo", ATMOSPHERE: "atmosfera", OTHER: "outro" };
function aspectText(details: unknown) {
  const values = details && typeof details === "object" && "aspects" in details ? details.aspects : null;
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string" && Boolean(aspects[value])).map((value) => aspects[value]).join(", ") : "";
}
export function DiscoveryMemory({ showWeekly = false }: { showWeekly?: boolean } = {}) {
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
    <header>
      <Fala level={1} headline="O que ficou pelo caminho." mark={["pelo caminho"]} markRef={mark} marked={pen.started.has("memory-title")}
        narrative="As buscas, as indicações e o que você me contou de cada uma. Dá pra retomar de onde parou." />
    </header>
    {showWeekly && <WeeklyHistory />}
    <form className={styles.filters} onSubmit={(event) => { event.preventDefault(); focusResults.current = true; setCursors([]); setQuery(draft.trim()); setAttempt((value) => value + 1); }}>
      <label>procurar um artista ou faixa<input maxLength={120} value={draft} onChange={(event) => { focusResults.current = false; setDraft(event.target.value); }} /></label>
      <button type="submit" disabled={loading}>procurar</button>
      <label className={styles.check}><input type="checkbox" checked={onlyResponses} onChange={(event) => { focusResults.current = false; setOnlyResponses(event.target.checked); setCursors([]); }} /> só os caminhos em que você respondeu</label>
    </form>
    <h2 ref={heading} tabIndex={-1} className={styles.resultTitle}>{query ? `Caminhos com “${query}”` : "Teus caminhos"}</h2>
    {loading && <p role="status">Abrindo teus caminhos…</p>}
    {error && <p role="alert">Não consegui abrir essa página. <button onClick={() => setAttempt((value) => value + 1)}>tenta de novo</button></p>}
    {page && <>
      {!page.sessions.length && <p>Nenhum caminho por aqui. Tenta outro nome.</p>}
      {page.sessions.map((session, index) => <section className={styles.session} key={session.id}>
        <div className={styles.chapter} aria-hidden="true"><span>caminho</span><strong>{String(index+1).padStart(2,"0")}</strong><i /></div><div className={styles.sessionSheet}>
        <div className={styles.sessionHeading}><div><p className={styles.eyebrow}>{when(session.createdAt)}</p><h2 ref={(node)=>{if(node)chapters.current.set(session.id,node);else chapters.current.delete(session.id);}}>{intentionLabel(session.intent as DiscoveryIntent | null)}</h2>
          {(session.album || session.anchor) && <p>{session.album ? `${session.album.albumName} · ${session.album.artistName}` : `A partir de “${session.anchor!.trackName}”, de ${session.anchor!.artistName}.`}</p>}
          {session.album && <EditionCredit album={session.album} />}
          {session.curation && <EditorialCredit curation={session.curation} />}
          <p className={styles.note}>{session.total} {session.total === 1 ? "indicação" : "indicações"}{session.items.length < session.total ? ` · ${session.items.length} neste recorte` : ""}{session.currentRank != null ? ` · ${session.currentRank <= session.total ? `posição ${session.currentRank}` : "chegou ao fim"}` : ""}</p></div>
          <Link href={`/discovery?session=${encodeURIComponent(session.id)}`}>retomar →</Link></div>
        {session.exports?.map((event, index) => <p className={styles.note} key={index}>Exportada em {when(event.createdAt)} · {event.resolvedCount} de {event.totalItems} faixas encontradas.</p>)}
        <DiscoveryDisclosure className={styles.details} summary="indicações e respostas" onOpenChange={(open)=>setActiveChapter(current=>open?session.id:current===session.id?null:current)}>
          <ol className={styles.tracks}>{session.items.map((item) => <li key={item.id}>
            <h3>{item.trackName}</h3><p>{item.artistName}</p>
            {item.reason && <p className={styles.note}>{item.reason}</p>}
            {item.listeningCues && <DiscoveryDisclosure className={styles.details} summary="o que reparar"><ListeningCueExcerpt value={item.listeningCues} /></DiscoveryDisclosure>}
            {Object.values(item.culturalContext ?? {}).map((value) => value && <DiscoveryDisclosure key={value.kind} className={styles.details} summary={`contexto · ${value.kind === "album" ? "álbum" : "música"}`}><ContextExcerpt value={value} /></DiscoveryDisclosure>)}
            {Boolean(item.exposedAt || item.starts?.length) && <p className={styles.note}>{[item.exposedAt && `vista em ${when(item.exposedAt)}`,
              ...(item.starts ?? []).map((event) => `prévia tocada em ${when(event.createdAt)}`)].filter(Boolean).join(" · ")}</p>}
            {item.feedback.length > 0 && <ol className={styles.responses}>{item.feedback.map((entry) => <li key={entry.id}>
              <p><time dateTime={entry.createdAt}>{when(entry.createdAt)}</time> · {MEMORY_LABEL[entry.type] ?? "resposta anterior"}{entry.revisesId ? " · revisão" : ""}</p>
              {entry.note && <blockquote>{entry.note}</blockquote>}
              {aspectText(entry.details) && <p className={styles.note}>Você destacou: {aspectText(entry.details)}.</p>}
            </li>)}</ol>}
            {item.moreFeedback && <p className={styles.note}>Tem respostas mais antigas. Retoma o caminho pra ver todas.</p>}
          </li>)}</ol>
        </DiscoveryDisclosure>
      </div></section>)}
      <nav className={styles.pagination}>
        <button disabled={loading || !cursors.length} onClick={() => { focusResults.current = true; setCursors((values) => values.slice(0, -1)); }}>← mais recentes</button>
        <a href={`${url}&download=1`}>baixar esta página (JSON)</a>
        <button disabled={loading || !page.nextCursor} onClick={() => { if (page.nextCursor) { focusResults.current = true; setCursors((values) => [...values, page.nextCursor!]); } }}>mais antigas →</button>
      </nav>
    </>}
    {error && cursors.length > 0 && <button onClick={() => setCursors((values) => values.slice(0, -1))}>voltar à página anterior</button>}
    <MemoryTools />
    <PenLayer pen={pen} signal={signal} reduced={reduced} />
  </div>;
}
