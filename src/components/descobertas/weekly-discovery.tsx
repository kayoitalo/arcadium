"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { privateFetch } from "@/lib/http/private-fetch";
import { Capa, Fala, PenLayer, Resposta, Respostas } from "@/components/amigo/fala";
import { band } from "@/components/amigo/gestures";
import { textLines } from "@/components/amigo/measure";
import { usePen } from "@/components/amigo/use-pen";
import { WEEKLY_TITLES, type WeeklyView } from "@/modules/recommendations/domain/weekly-journey";
import { EditionCredit } from "./album-journeys";
import { DiscoveryDisclosure } from "./discovery-disclosure";
import styles from "./weekly-discovery.module.css";

type Report = { current: WeeklyView | null; previous: WeeklyView | null; canPrepare: boolean };
type Entry = WeeklyView["entries"][number];

function period(week: WeeklyView) {
  const format = new Intl.DateTimeFormat("pt-BR", { timeZone: week.timezone, day: "numeric", month: "short" });
  return `${format.format(new Date(week.startsAt))} a ${format.format(new Date(Date.parse(week.endsAt) - 1))}`;
}

async function weeklyRequest<T>(suffix = "", body?: object, signal?: AbortSignal): Promise<T> {
  const response = await privateFetch(`/api/weekly-journey${suffix}`, {
    signal, ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error("Jornada semanal indisponível.");
  return response.json() as Promise<T>;
}

function WeeklyDoor({ entry, children }: { entry: Entry; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!ref.current || entry.exposedAt || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([event]) => {
      if (!event.isIntersecting || event.intersectionRatio < 0.35 || document.visibilityState === "hidden") return;
      observer.disconnect();
      void weeklyRequest("", { action: "EXPOSE", entryId: entry.id }).catch(() => undefined);
    }, { threshold: 0.35 });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [entry.id, entry.exposedAt]);
  return <article ref={ref} className={styles.door}>{children}</article>;
}

export function WeeklyDiscovery({ journeyId, allowNarrative, onStart = (id) => window.location.assign(`/discovery?session=${encodeURIComponent(id)}`) }: {
  journeyId?: string | null; allowNarrative?: boolean; onStart?: (id: string) => void;
}) {
  const [report, setReport] = useState<Report | null>(null);
  const [waiting, setWaiting] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState<string | null>(null);
  const [narrating, setNarrating] = useState(false);
  const [showNarrative, setShowNarrative] = useState(false);
  const section = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLSpanElement>(null);
  const signal = useRef(null);
  const reduced = Boolean(useReducedMotion());
  const active = useRef(false);
  const week = report?.current?.status === "READY" ? report.current : report?.previous ?? null;
  const pen = usePen(section, (origin) => {
    if (!mark.current) return null;
    const measured = textLines(mark.current, origin);
    const ink = band(measured.lines, measured.size);
    return { gestures: [{ id: "semana", layer: "under", strokes: ink.strokes, width: ink.width, cap: "butt" }], wave: null, notes: [] };
  }, week?.id ?? "semana");

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    setWaiting(true); setError("");
    const load = async () => {
      const suffix = journeyId ? `?id=${encodeURIComponent(journeyId)}` : "";
      const initial = await weeklyRequest<Report>(suffix, undefined, controller.signal);
      if (controller.signal.aborted) return;
      setReport(initial);
      const next = !journeyId && initial.canPrepare
        ? await weeklyRequest<Report>("", { action: "PREPARE" }, controller.signal) : initial;
      if (controller.signal.aborted) return;
      setReport(next);
      if (!journeyId && next.current?.status === "PREPARING") {
        const poll = (remaining: number) => {
          timer = setTimeout(async () => {
            try {
              const fresh = await weeklyRequest<Report>("", undefined, controller.signal);
              if (controller.signal.aborted) return;
              setReport(fresh);
              if (fresh.current?.status === "PREPARING" && remaining > 1) poll(remaining - 1);
              else setWaiting(false);
            } catch { if (!controller.signal.aborted) { setError("Não consegui consultar esta semana."); setWaiting(false); } }
          }, 3000);
        };
        poll(12);
      } else setWaiting(false);
    };
    void load().catch(() => { if (!controller.signal.aborted) { setWaiting(false); setError("Não consegui preparar a jornada agora."); } });
    return () => { controller.abort(); clearTimeout(timer); };
  }, [journeyId, reload]);

  async function start(entry: Entry) {
    if (active.current) return;
    active.current = true; setStarting(entry.id); setError("");
    try {
      const { sessionId } = await weeklyRequest<{ sessionId: string }>("", { action: "START", entryId: entry.id });
      onStart(sessionId);
    } catch { setError("Não consegui abrir esta porta. Tenta de novo."); }
    finally { active.current = false; setStarting(null); }
  }

  async function narrate() {
    if (!week || narrating) return;
    if (week.narrative) { setShowNarrative((value) => !value); return; }
    setNarrating(true);
    try {
      const next = await weeklyRequest<WeeklyView>("", { action: "NARRATE", journeyId: week.id });
      setReport((old) => old ? { ...old, ...(old.current?.id === next.id ? { current: next } : { previous: next }) } : old);
      if (next.narrative) setShowNarrative(true);
    } catch { setError("A apresentação experimental está indisponível agora."); }
    finally { setNarrating(false); }
  }

  const currentStatus = report?.current?.status;
  const narrative = showNarrative ? week?.narrative : undefined;
  const count = week?.entries.length ?? 0;
  const doors = count === 1 ? "uma porta" : `${count} portas`;
  const previous = Boolean(week && report?.previous?.id === week.id);
  // uma manchete só: o que a semana tem, com o grifo na contagem
  const headline = !week ? "Tua jornada da semana." : previous ? `A semana passada teve ${doors}.` : `Essa semana tem ${doors}.`;
  return <div ref={section} className={styles.week} role="region" aria-label="Tua jornada da semana">
    <header className={styles.head}>
      <Fala level={1} window={week ? `${previous ? "semana anterior · " : ""}${period(week)}` : undefined} headline={headline}
        mark={week ? [doors] : ["semana"]} markRef={mark} marked={pen.started.has("semana")}
        narrative={narrative?.opening ?? "Abre uma de cada vez. Teu lugar em cada uma fica guardado."} />
    </header>
    {waiting && <p role="status">Conferindo as portas desta semana…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={() => setReload((value) => value + 1)}>consultar novamente</button></p>}
    {!waiting && currentStatus === "FAILED" && <p>A consulta ficou interrompida. <button type="button" onClick={() => setReload((value) => value + 1)}>conferir novamente</button></p>}
    {!waiting && currentStatus === "PREPARING" && <p>A semana ainda está sendo preparada. <button type="button" onClick={() => setReload((value) => value + 1)}>ver se ficou pronta</button></p>}
    {currentStatus === "EMPTY" && <p>Essa semana não achei uma porta que eu pudesse confirmar. A estante e os outros caminhos continuam aqui.</p>}
    {week && <>
      {week.limited && <p>Essa semana ficou com {doors}.</p>}
      {!week.personalized && <p>Ainda conheço pouco do teu histórico, então começo por uma porta do catálogo.</p>}
      <ol className={styles.doors}>{week.entries.map((entry) => {
        const name = entry.album?.albumName ?? entry.artistName;
        return <li key={entry.id}><WeeklyDoor entry={entry}>
          <Capa cover={{ url: entry.album?.artworkUrl, title: name, artist: entry.artistName }} className={styles.doorCover} />
          <div className={styles.doorText}>
            <p className={styles.eyebrow}>{WEEKLY_TITLES[entry.role]} · {entry.kind === "ALBUM" ? "álbum em ordem" : "faixas do artista"}</p>
            <h2>{name}</h2>
            {entry.album && <p className={styles.artist}>{entry.artistName}</p>}
            <p>{entry.reason}</p>
            {narrative?.transitions[entry.id] && <p>{narrative.transitions[entry.id]}</p>}
            <p className={styles.state} data-started={Boolean(entry.sessionId) || undefined}>{entry.sessionId ? "em andamento" : "nova"}</p>
            <Respostas inline>{entry.sessionId
              ? <Resposta primary href={`/discovery?session=${encodeURIComponent(entry.sessionId)}`}>{`seguir com ${name} →`}</Resposta>
              : <Resposta disabled={Boolean(starting)} onClick={() => void start(entry)}>{starting === entry.id ? "abrindo…" : entry.kind === "ALBUM" ? "começar o disco →" : `começar com ${entry.artistName} →`}</Resposta>}</Respostas>
            <DiscoveryDisclosure summary={entry.kind === "ALBUM" ? "conferir a edição" : "ver as faixas da entrada"}>
              {entry.album ? <EditionCredit album={entry.album} /> : <><p>{entry.trackSource === "lastfm" ? "Faixas populares no Last.fm, filtradas pelas tuas escutas." : "Faixas identificadas no catálogo local."}</p>
                <ol>{entry.tracks?.map((track) => <li key={track}>{track}</li>)}</ol></>}
              {entry.reference.url && <p><a href={entry.reference.url} target="_blank" rel="noreferrer">referência no Last.fm ↗</a></p>}
            </DiscoveryDisclosure>
          </div>
        </WeeklyDoor></li>;
      })}</ol>
      {allowNarrative && <div className={styles.narrative}><button type="button" disabled={narrating || week.narrativeStatus === "PREPARING" || week.narrativeStatus === "FAILED"} onClick={() => void narrate()}>
        {narrating || week.narrativeStatus === "PREPARING" ? "preparando a apresentação…" : week.narrativeStatus === "FAILED" ? "apresentação experimental indisponível" : showNarrative ? "voltar ao texto simples" : "experimentar outra apresentação"}
      </button>{showNarrative && <p>Apresentação experimental com IA. As escolhas e as fontes são as mesmas.</p>}</div>}
    </>}
    <PenLayer pen={pen} signal={signal} reduced={reduced} />
  </div>;
}

export function WeeklyHistory() {
  const [open, setOpen] = useState(false);
  const [weeks, setWeeks] = useState<WeeklyView[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const inFlight = useRef(false);
  async function load(before?: string) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError(false);
    try {
      const { weeks: rows, nextCursor } = await weeklyRequest<{ weeks: WeeklyView[]; nextCursor: string | null }>(`?history=1${before ? `&before=${encodeURIComponent(before)}` : ""}`);
      setWeeks((previous) => [...(before ? previous ?? [] : []), ...rows]); setCursor(nextCursor);
    } catch { setError(true); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <DiscoveryDisclosure className={styles.history} summary="semanas anteriores" open={open} onOpenChange={(value) => {
    setOpen(value); if (value && weeks === null) void load();
  }}>
    {busy && <p role="status">Abrindo as semanas…</p>}
    {error && <p role="alert">Não consegui carregar as semanas. <button onClick={() => void load(weeks ? cursor ?? undefined : undefined)}>tentar novamente</button></p>}
    {weeks?.length === 0 && <p>As jornadas que você abrir vão aparecer aqui.</p>}
    <ol>{weeks?.map((week) => <li key={week.id}><Link href={`/discovery/week?semana=${encodeURIComponent(week.id)}`}>{period(week)} · {week.entries.length} {week.entries.length === 1 ? "porta" : "portas"} →</Link></li>)}</ol>
    {cursor && <button disabled={busy} onClick={() => void load(cursor)}>ver semanas anteriores</button>}
  </DiscoveryDisclosure>;
}
