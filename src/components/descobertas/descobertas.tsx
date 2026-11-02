"use client";

import { privateFetch } from "@/lib/http/private-fetch";
import Link from "next/link";

import { AnimatePresence, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Aviso } from "@/components/amigo/aviso";
import { Capa, PenLayer, Resposta, Respostas } from "@/components/amigo/fala";
import { band, frame } from "@/components/amigo/gestures";
import { boxOf, textLines } from "@/components/amigo/measure";
import type { TraceGesture, WaveSpec } from "@/components/amigo/trace";
import { usePen, type PenDrawing } from "@/components/amigo/use-pen";
import { usePulse } from "@/components/amigo/use-pulse";
import { useSound } from "@/components/amigo/use-sound";
import { genreLabel } from "@/lib/format/genre";
import { Mapa, type MapDot } from "./mapa";
import { useSelection } from "./selection-provider";
import { MAX_SELECTED_TRACKS, selectionKey } from "./selection";
import styles from "./descobertas.module.css";
import { DiscoveryEntry } from "./discovery-entry";
import { DiscoveryTrack } from "./discovery-track";
import { discoveryEntryLabel } from "./discovery-view";
import { DiscoveryHistory } from "./discovery-history";
import { DiscoveryDisclosure } from "./discovery-disclosure";
import { DiscoveryTransition, useDiscoveryScene } from "./discovery-transition";
import type { DiscoveryContext, DiscoveryIntent } from "@/modules/recommendations/domain/discovery-intent";
import { ASPECTS, feedbackChannel, type FeedbackEntry, type FeedbackChannel } from "@/modules/recommendations/domain/feedback";

interface Candidate {
  id: string;
  artistName: string;
  trackName: string;
  albumName: string | null;
  coverUrl?: string | null;
  previewUrl?: string | null;
  appleMusicUrl?: string | null;
  genre: string | null;
  reason: string | null;
  position: { proximity: number; fame: number } | null;
  rank: number;
  feedback?: Partial<Record<FeedbackChannel, FeedbackEntry>>;
  sourceUrl?: string | null;
  isRevisit?: boolean;
}

type Action = "liked" | "saved" | "known" | "skipped" | "disliked" | "mismatch" | "curious" | "unheard";
type LoadOperation = "BOOTSTRAP" | "RESUME" | "MORE" | "NEW_ENTRY" | "DEEPEN";
type SearchOptions = { intent?: DiscoveryIntent; itemId?: string; sessionId?: string };
type Journey = DiscoveryContext["journey"] & { rootSessionId: string };

interface ExportResult {
  playlistTitle?: string;
  playlistUrl?: string;
  mode?: string;
  resolvedCount?: number;
  addedCount?: number;
  partial?: boolean;
  totalItems?: number;
  m3uPayload?: string;
  error?: string;
}

const FEEDBACK_API: Record<Action, string> = {
  liked: "LIKED",
  saved: "SAVE_FOR_LATER",
  known: "ALREADY_KNOW",
  skipped: "SKIPPED",
  disliked: "DISLIKED", mismatch: "REQUEST_MISMATCH", curious: "CURIOUS", unheard: "NOT_LISTENED",
};

const HOW: Record<Action, string> = { liked: "curtiu", saved: "guardou", known: "já conhecia", skipped: "pulou",
  disliked: "não curtiu", mismatch: "não era o pedido", curious: "ficou curioso", unheard: "ainda não ouviu" };
const FEEDBACK_LABEL: Record<string, string> = { ...Object.fromEntries(Object.entries(FEEDBACK_API).map(([action, type]) => [type, HOW[action as Action]])), NOT_INTERESTED: "sem interesse (registro antigo)" };
const ASPECT_LABEL: Record<string, string> = { VOCALS: "vocal", INSTRUMENTAL: "instrumental", LYRICS: "letra", RHYTHM: "ritmo", ATMOSPHERE: "atmosfera", OTHER: "outro" };

/** Os cantos do mapa que valem a visita, ditos como ele diria. */
const CORNERS = [
  { label: "quase em casa", proximity: 88, fame: 70 },
  { label: "um passo ao lado", proximity: 55, fame: 50 },
  { label: "fora da bolha", proximity: 18, fame: 30 },
  { label: "como nunca ouvi isso?", proximity: 62, fame: 92 },
];

/**
 * Pra ouvir depois. Ele indica uma faixa por vez, dizendo de onde tirou
 * a ideia; você ouve ali mesmo e responde. Tocando, a corda dele abraça a
 * capa e vibra com o som. Embaixo, o mapa que decide onde ele procura, e
 * o que você separou para levar.
 */
export function Descobertas({ initialSessionId = null, initialCollectionOpen = false }: { initialSessionId?: string | null; initialCollectionOpen?: boolean } = {}) {
  const reduced = Boolean(useReducedMotion());
  const [proximity, setProximity] = useState(55);
  const [fame, setFame] = useState(50);
  const [draftProximity, setDraftProximity] = useState(55);
  const [draftFame, setDraftFame] = useState(50);
  const [choosing, setChoosing] = useState(true);
  const [mediaState, setMediaState] = useState("idle");
  const [mediaAttempt, setMediaAttempt] = useState(0);
  const [mapOpen, setMapOpen] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(initialCollectionOpen);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const [queue, setQueue] = useState<Candidate[] | null>(null);
  const [index, setIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [intent, setIntent] = useState<DiscoveryIntent | null>(null);
  const intentRef = useRef<DiscoveryIntent>("DISCOVER");
  const [journey, setJourney] = useState<Journey | null>(null);
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [aspects, setAspects] = useState<string[]>([]);
  const suggestionRef = useRef<HTMLElement>(null);
  const sessionRef = useRef<string | null>(null);
  const pendingSearch = useRef<{ signature: string; key: string } | null>(null);
  const lastLoad = useRef<{ proximity: number; fame: number; operation: LoadOperation; options?: SearchOptions }>({ proximity: 55, fame: 50, operation: "BOOTSTRAP" });
  const pendingFeedback = useRef<{ signature: string; key: string } | null>(null);
  const [decided, setDecided] = useState<Record<string, Action>>({});
  const [exported, setExported] = useState<"running" | ExportResult | null>(null);
  const [exportHidden, setExportHidden] = useState(false);
  const modalOpen = Boolean(exported) && !exportHidden;
  const [saving, setSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const exportRef = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const selection = useSelection();
  const kept = selection.items;
  const requestRef = useRef(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const sound = useSound();
  const { stop, toggle } = sound;
  const signal = usePulse(stageRef, sound.playing, sound.read);

  const applySession = useCallback((payload: { items?: Candidate[]; sessionId?: string; currentRank?: number; journey?: Journey | null; settings?: { intent?: DiscoveryIntent | null; dials?: { proximity: number; fame: number } } }) => {
    const items = payload.items ?? [];
    setQueue(items); setSessionId(payload.sessionId ?? null);
    sessionRef.current = payload.sessionId ?? null;
    setIntent(payload.settings?.intent ?? null); intentRef.current = payload.settings?.intent ?? "DISCOVER";
    setJourney(payload.journey ?? null);
    setIndex(Math.min(items.length, Math.max(0, (payload.currentRank ?? 1) - 1)));
    setDecided(Object.fromEntries(items.filter((item) => Object.values(item.feedback ?? {}).some((entry) => entry?.type !== "RETRACTED")).map((item) => [item.id, "known" as Action])));
    if (payload.settings?.dials) { setProximity(payload.settings.dials.proximity); setFame(payload.settings.dials.fame); setDraftProximity(payload.settings.dials.proximity); setDraftFame(payload.settings.dials.fame); }
  }, []);

  const load = useCallback(async (nextProximity: number, nextFame: number, operation: LoadOperation = "NEW_ENTRY", options: SearchOptions = {}) => {
    if (savingRef.current) return;
    const nextIntent = options.intent ?? intentRef.current;
    const source = options.sessionId ?? sessionRef.current ?? undefined;
    lastLoad.current = { proximity: nextProximity, fame: nextFame, operation, options: { ...options, intent: nextIntent, sessionId: source } };
    const token = ++requestRef.current;
    stop(); setBusy(true); setFailed(false); setLoadError(null); setFeedbackError(null);
    if (operation !== "BOOTSTRAP") setChoosing(false);
    try {
      let response: Response;
      if (operation === "BOOTSTRAP") {
        response = await privateFetch("/api/recommendations");
        if (!response.ok) throw new Error((await response.json()).error ?? "Não consegui retomar a sessão.");
        const existing = await response.json();
        if (token !== requestRef.current) return;
        if (existing.sessionId) {
          applySession(existing);
          // Loading saved state must not choose a listening intention for the user.
          setChoosing(true);
        } else { applySession({ items: [] }); setChoosing(true); }
        return;
      }
      const action = operation;
      const signature = JSON.stringify([action, source, nextProximity, nextFame, nextIntent, options.itemId]);
      if (pendingSearch.current?.signature !== signature) pendingSearch.current = { signature, key: crypto.randomUUID() };
      response = await privateFetch("/api/recommendations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: action, sessionId: source, requestKey: pendingSearch.current.key,
          intent: nextIntent, sourceItemId: options.itemId,
          mode: "BALANCED", context: "GENERAL", proximity: nextProximity, fame: nextFame }),
      });
      const payload = await response.json();
      if (token !== requestRef.current) return;
      if (!response.ok) {
        if (payload.code === "GENERATION_FAILED") pendingSearch.current = null;
        throw new Error(payload.error ?? "Não consegui buscar agora.");
      }
      pendingSearch.current = null; applySession(payload); setMapOpen(false);
    } catch (cause) {
      if (token === requestRef.current) { setFailed(true); setLoadError(cause instanceof Error ? cause.message : "A conexão falhou."); }
    } finally { if (token === requestRef.current) setBusy(false); }
  }, [applySession, stop]);

  useEffect(() => { void load(55, 50, initialSessionId ? "RESUME" : "BOOTSTRAP", initialSessionId ? { sessionId: initialSessionId } : {}); return () => { requestRef.current += 1; }; }, [load, initialSessionId]);

  const move = useCallback((nextProximity: number, nextFame: number) => {
    setDraftProximity(nextProximity);
    setDraftFame(nextFame);
  }, []);

  const commit = useCallback(
    (nextProximity: number, nextFame: number) => {
      if (savingRef.current) return;
      move(nextProximity, nextFame);

    },
    [move],
  );

  const current = queue?.[index] ?? null;
  const scene = useDiscoveryScene(current && sessionId && !choosing && !busy && !failed ? `${sessionId}:${current.id}` : null);
  const changing = scene.identity !== null && !scene.ready;
  useEffect(() => {
    if (!scene.ready || choosing || busy || !sessionId || !current) return;
    if (current.previewUrl && current.coverUrl) { setMediaState("ready"); return; }
    const controller = new AbortController();
    const itemId = current.id;
    setMediaState("loading");
    void privateFetch(`/api/recommendations/${sessionId}/media`, {
      method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
      body: JSON.stringify({ itemId }),
    }).then(async (response) => {
      if (!response.ok) throw new Error("media");
      const result = await response.json();
      if (controller.signal.aborted) return;
      setQueue((items) => items?.map((item) => item.id === itemId ? { ...item, coverUrl: result.coverUrl,
        previewUrl: result.previewUrl, appleMusicUrl: result.appleMusicUrl } : item) ?? null);
      setMediaState(result.status);
    }).catch(() => { if (!controller.signal.aborted) setMediaState("error"); });
    return () => controller.abort();
  }, [current?.id, sessionId, choosing, busy, mediaAttempt, scene.ready]);
  const finished = queue !== null && queue.length > 0 && index >= queue.length;

  const showEntries = () => {
    if (savingRef.current || busy || changing) return;
    stop(); setChoosing(true); setFailed(false); setLoadError(null); setFeedbackError(null);
    setDraftProximity(proximity); setDraftFame(fame);
    window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
  };
  const openMap = () => {
    setMapOpen(true);
    requestAnimationFrame(() => document.getElementById("mapa-descoberta")?.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" }));
  };
  useEffect(() => {
    if (!scene.ready || choosing || busy || modalOpen || !current || !headlineRef.current) return;
    const headline = headlineRef.current;
    headline.tabIndex = -1;
    headline.focus({ preventScroll: true });
    const rect = headline.getBoundingClientRect();
    if (rect.top < 90 || rect.top > window.innerHeight / 2) headline.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
  }, [current?.id, choosing, busy, scene.ready, scene.visit, reduced]);

  useEffect(() => { setNote(""); setAspects([]); }, [current?.id]);

  useEffect(() => {
    const element = suggestionRef.current;
    if (!scene.ready || !element || !current || !sessionId || busy || modalOpen || choosing || !("IntersectionObserver" in window)) return;
    let active = true;
    let visible = false;
    let sent = false;
    let sending = false;
    const expose = async () => {
      if (!active || sent || sending || !visible || document.visibilityState !== "visible") return;
      sending = true;
      try {
        const response = await privateFetch(`/api/recommendations/${sessionId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operation: "EXPOSE", itemId: current.id }),
        });
        sent = response.ok;
      } catch { /* A failed observation is not a negative preference. */ }
      finally { sending = false; }
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting && entry.intersectionRatio >= 0.5; void expose(); }, { threshold: 0.5 });
    observer.observe(element);
    document.addEventListener("visibilitychange", expose);
    return () => { active = false; observer.disconnect(); document.removeEventListener("visibilitychange", expose); };
  }, [current?.id, sessionId, busy, modalOpen, choosing, scene.ready, scene.visit]);

  const moveTo = async (nextIndex: number) => {
    if (!sessionId || savingRef.current || busy || changing || !queue) return;
    savingRef.current = true; setSaving(true); setFeedbackError(null); stop();
    try {
      const response = await privateFetch(`/api/recommendations/${sessionId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "MOVE", rank: nextIndex + 1, expectedRank: index + 1 }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Não consegui mudar de posição.");
      setIndex(payload.currentRank - 1);
    } catch (cause) { setFeedbackError(cause instanceof Error ? cause.message : "A conexão falhou."); }
    finally { savingRef.current = false; setSaving(false); }
  };

  // outra faixa na frente: a anterior para de tocar
  useEffect(() => {
    stop();
  }, [current?.id, stop]);

  const decide = useCallback(
    async (action: Action | "retract", revisesId?: string) => {
      if (!scene.ready || !current || busy || savingRef.current || ((action === "liked" || action === "saved") && !selection.ready)) return;
      if ((action === "liked" || action === "saved") && selection.items.length >= MAX_SELECTED_TRACKS && !selection.items.some((item) => selectionKey(item) === selectionKey(current))) {
        setFeedbackError("A coleção está com 200 faixas. Remova uma antes de guardar outra.");
        return;
      }
      savingRef.current = true;
      setSaving(true);
      setFeedbackError(null);
      stop();
      try {
        if (!sessionId) throw new Error("Não consegui identificar a busca. Tenta buscar de novo.");
        const type = action === "retract" ? "RETRACTED" : FEEDBACK_API[action];
        const target = revisesId ?? current.feedback?.[feedbackChannel(type)]?.id;
        const body = { itemId: current.id, type, note: note || undefined,
          details: aspects.length ? { aspects: [...aspects].sort() } : undefined,
          revisesId: target, advance: action !== "retract" };
        const signature = JSON.stringify(body);
        if (pendingFeedback.current?.signature !== signature) pendingFeedback.current = { signature, key: crypto.randomUUID() };
        const response = await privateFetch("/api/recommendations/" + sessionId + "/feedback", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, requestKey: pendingFeedback.current.key }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Não consegui guardar tua resposta. A faixa continua aqui.");
        pendingFeedback.current = null;
        const states = payload.states as Candidate["feedback"];
        // Collection changes commit with feedback; a failed refresh must not resubmit a vote.
        void selection.refresh(true);
        setQueue((previous) => previous?.map((item) => item.id === current.id ? { ...item, feedback: states } : item) ?? null);
        if (action !== "retract") setDecided((previous) => ({ ...previous, [current.id]: action }));
        if (payload.currentRank != null) setIndex(payload.currentRank - 1);
        if (payload.session) applySession(payload.session);

      } catch (cause) {
        setFeedbackError(cause instanceof Error ? cause.message : "A conexão falhou. Tenta responder de novo.");
      } finally {
        savingRef.current = false;
        setSaving(false);
      }
    },
    [current, sessionId, stop, busy, selection, note, aspects, applySession, scene.ready],
  );

  const toggleSound = useCallback(() => {
    if (scene.ready && current?.previewUrl) toggle(current.previewUrl);
  }, [current, toggle, scene.ready]);

  useEffect(() => {
    if (!scene.ready || !current || modalOpen || choosing || busy) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, details, [role='group']")) return;
      // num botão ou link com foco, espaço e Enter são dele
      if ((event.key === " " || event.key === "Enter") && target?.closest("button, a")) return;
      const key = event.key.toLowerCase();
      if (key === " ") {
        event.preventDefault();
        toggleSound();
      } else if (key === "arrowup") {
        event.preventDefault();
        decide("liked");
      } else if (key === "arrowdown") {
        event.preventDefault();
        decide("saved");
      } else if (key === "arrowright") {
        event.preventDefault();
        decide("skipped");
      } else if (key === "k") decide("known");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, decide, modalOpen, choosing, busy, toggleSound, scene.ready]);

  /** As sugestões desta busca, nos mesmos eixos que você regulou. */
  const dots = useMemo<MapDot[]>(
    () =>
      (queue ?? [])
        .filter((item) => item.position)
        .map((item) => ({
          id: item.id,
          proximity: item.position!.proximity,
          fame: item.position!.fame,
          done: Boolean(decided[item.id]),
          current: item.id === current?.id,
        })),
    [queue, decided, current?.id],
  );

  const exportKept = async () => {
    if (exportRef.current || kept.length === 0) return;
    exportRef.current = true;
    setExportHidden(false);
    setExported("running");
    try {
      const response = await privateFetch("/api/spotify/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tracks: kept.map((item) => ({ trackName: item.trackName, artistName: item.artistName })) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "A exportação falhou.");
      setExported(payload.data as ExportResult);
    } catch (cause) {
      setExported({ error: cause instanceof Error ? cause.message : "A exportação falhou." });
    } finally {
      exportRef.current = false;
    }
  };

  const downloadM3u = (result: ExportResult) => {
    const blob = new Blob([result.m3uPayload ?? ""], { type: "audio/x-mpegurl" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${result.playlistTitle ?? "arcadium"}.m3u`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!modalOpen) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    const header = document.getElementById("arcadium-header");
    const headerWasInert = header?.inert;
    if (header) header.inert = true;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setExportHidden(true); }
      if (event.key !== "Tab") return;
      const elements = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]');
      if (!elements?.length) { event.preventDefault(); dialogRef.current?.focus(); return; }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      if (header) header.inert = headerWasInert ?? false;
      document.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [modalOpen]);

  // ---------- onde o traço vai ----------

  const showing = Boolean(scene.ready && current && !busy && !choosing && !failed);


  const draw = (origin: DOMRect): PenDrawing | null => {
    if (!showing) return null;
    const gestures: TraceGesture[] = [];
    let wave: WaveSpec | null = null;
    const mark = markRef.current;
    if (mark) {
      const { lines, size } = textLines(mark, origin);
      if (lines.length > 0) {
        const { strokes, width } = band(lines, size);
        gestures.push({ id: `grifo:${current?.id}`, layer: "under", strokes, width, cap: "butt" });
      }
    }
    const cover = coverRef.current;
    if (cover && sound.playing) {
      const box = boxOf(cover, origin);
      // tocando, a corda abraça a capa e só incha para fora: nunca cobre a arte
      wave = {
        base: frame(box, 12),
        amp: Math.min(22, box.width * 0.06),
        outwardFrom: { x: box.left + box.width / 2, y: box.top + box.height / 2 },
        width: Math.max(1.5, Math.min(2.5, origin.width / 600)),
      };
    }
    return { gestures, wave, notes: [] };
  };

  const penSubject = `${scene.visit}:${current?.id}`;
  const penPose = `${showing ? penSubject : "-"}|${sound.playing ? "som" : ""}`;
  const pen = usePen(stageRef, draw, penPose);
  const penInPlace = Boolean(showing && pen.plan?.key.startsWith(`${penSubject}|`));
  useEffect(() => { pen.forget("grifo:"); }, [scene.visit, pen.forget]);

  // ---------- o que aparece em cima ----------

  let top: React.ReactNode;
  if (choosing) {
    top = <>
      <DiscoveryEntry busy={busy || saving} hasSession={Boolean(sessionId && queue?.length)} currentRank={index + 1} total={queue?.length ?? 0}
        onChoose={(nextProximity, nextFame, nextIntent) => void load(nextProximity, nextFame, "NEW_ENTRY", { intent: nextIntent })}
        onResume={() => void load(proximity, fame, "RESUME")} onAdjust={() => { intentRef.current = "DISCOVER"; setIntent("DISCOVER"); openMap(); }} />
      {busy && <p className={styles.quiet} role="status">Recuperando tua última busca…</p>}
      {loadError && <p className={styles.entryError} role="alert">{loadError} <button className={styles.textButton} onClick={() => void load(55, 50, "BOOTSTRAP")}>tentar novamente</button></p>}
    </>;
  } else if (!queue && failed) {
    top = (
      <Aviso headline="Me perdi procurando." narrative={loadError ?? "Não consegui montar as sugestões."}>
        <Resposta onClick={() => void load(lastLoad.current.proximity, lastLoad.current.fame, lastLoad.current.operation, lastLoad.current.options)}>tenta de novo</Resposta>
        <Resposta onClick={showEntries}>escolher outro caminho</Resposta>
      </Aviso>
    );
  } else if (!queue || busy) {
    top = <Aviso window="seguindo as tuas pistas" headline="Peraí. Tua próxima descoberta está a caminho." narrative="Estou cruzando referências e separando as indicações. Não precisa escolher mais nada agora." />;
  } else if (failed) {
    top = (
      <Aviso headline="Me perdi procurando." narrative={loadError ?? "Não consegui buscar nesse canto."}>
        <Resposta onClick={() => void load(lastLoad.current.proximity, lastLoad.current.fame, lastLoad.current.operation, lastLoad.current.options)}>tenta de novo</Resposta>
        <Resposta onClick={showEntries}>escolher outro caminho</Resposta>
      </Aviso>
    );
  } else if (queue.length === 0) {
    top = (
      <Aviso
        window="pra ouvir depois"
        headline={intent === "REPERTOIRE" ? "Não encontrei uma seleção por aqui." : "Nada novo nesse canto."}
        narrative={intent === "REPERTOIRE" ? "Não encontrei faixas elegíveis no teu histórico para esta seleção. Você pode voltar aos caminhos anteriores ou buscar novidades." : "As referências desta busca não renderam outra indicação. A gente pode tentar outro caminho."}
      >{journey?.parentSessionId && <Resposta onClick={() => void load(proximity, fame, "RESUME", { sessionId: journey.parentSessionId })}>voltar ao passo anterior</Resposta>}
        <Resposta onClick={showEntries}>escolher outro caminho</Resposta>{intent !== "REPERTOIRE" && <Resposta onClick={openMap}>ajustar a busca</Resposta>}</Aviso>
    );
  } else if (finished || !current) {
    top = (
      <Aviso
        window="pra ouvir depois"
        headline={kept.length > 0 ? `Você separou ${kept.length}.` : "Chegamos ao fim desta busca."}
        narrative={
          kept.length > 0
            ? "Tua pilha para depois está aqui. Dá para levar pro Spotify ou continuar descobrindo."
            : "A gente pode seguir essas pistas ou escolher outro caminho."
        }
      >
        {kept.length > 0 && <Resposta onClick={() => void exportKept()}>levar {kept.length} pro Spotify</Resposta>}
        <Resposta onClick={() => void load(proximity, fame, "MORE")}>busca mais nesse canto</Resposta>
        <Resposta onClick={showEntries}>escolher outro caminho</Resposta>
        {index > 0 && <Resposta onClick={() => void moveTo(index - 1)}>rever a anterior</Resposta>}
      </Aviso>
    );
  } else {
    top = (
      <div>
        {journey?.parentSessionId && <div className={styles.journeyContext}>
          {journey.anchor ? <>Este caminho parte de “{journey.anchor.trackName}”, de {journey.anchor.artistName}.</> : "Este passo continua uma busca anterior."}
          {journey.parentSessionId && <> <button className={styles.textButton} disabled={busy || saving} onClick={() => void load(proximity, fame, "RESUME", { sessionId: journey.parentSessionId })}>voltar ao passo anterior →</button></>}
        </div>}
        <DiscoveryTrack title={current.trackName} artist={current.artistName} reason={current.reason} isRevisit={current.isRevisit}
          sectionRef={suggestionRef} headlineRef={headlineRef} markRef={markRef} marked={penInPlace && pen.started.has("grifo:" + current.id)}
          entryLabel={discoveryEntryLabel(proximity, intent)} index={index} total={queue.length} onChangeEntry={showEntries}
          onPlay={toggleSound} canPlay={Boolean(current.previewUrl)} playing={sound.playing} loading={sound.loading || mediaState === "loading"}
          artwork={<Capa cover={{ url: current.coverUrl, title: current.albumName ?? current.trackName, artist: current.artistName }} playing={sound.playing} innerRef={coverRef} className={styles.cover} eager />}
          metadata={<>{current.genre && <span>{genreLabel(current.genre)} · </span>}{current.previewUrl ? "prévia de 30s" : mediaState === "loading" ? "buscando capa e prévia…" : mediaState === "error" ? "falha temporária na busca de mídia" : "prévia não encontrada no catálogo consultado"}
            {mediaState === "error" && <button className={styles.textButton} onClick={() => setMediaAttempt((value) => value + 1)}>tentar novamente</button>}
            {current.appleMusicUrl && <> · <a href={current.appleMusicUrl} target="_blank" rel="noreferrer">Apple Music ↗</a></>}
            {current.sourceUrl && <> · <a href={current.sourceUrl} target="_blank" rel="noreferrer">referência no Last.fm ↗</a></>}
          </>} />
        <div className={styles.decisionBar}>
        <Respostas>
          <p className={styles.feedback} role={feedbackError || sound.error ? "alert" : "status"}>
            {feedbackError || sound.error || (saving ? "Guardando tua resposta…" : "O que você separar fica na lista, mesmo se mudar o mapa.")}
          </p>
          <Resposta onClick={() => void decide("liked")} hint="↑" disabled={saving || !selection.ready} primary>
            curti
          </Resposta>
          <Resposta onClick={() => void decide("saved")} hint="↓" disabled={saving || !selection.ready}>
            guardo pra depois
          </Resposta>
          <Resposta onClick={() => void decide("skipped")} hint="→" disabled={saving}>
            pula
          </Resposta>
        </Respostas>
        </div>
        <DiscoveryDisclosure className={styles.review} key={current.id} summary="outras respostas ou revisar">
          <p>Pular, ainda não ouvir e não ser o pedido não significam que você não gosta da música.</p>
          <fieldset disabled={saving}>
            <legend>Quer contar o que chamou atenção? É opcional.</legend>
            {ASPECTS.map((aspect) => <label key={aspect}>
              <input type="checkbox" checked={aspects.includes(aspect)} onChange={(event) => setAspects((values) => event.target.checked ? [...values, aspect] : values.filter((value) => value !== aspect))} /> {ASPECT_LABEL[aspect]}
            </label>)}
            <label>Comentário opcional<textarea maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} /></label>
          </fieldset>
          <Respostas inline label="Outras respostas">
            <Resposta onClick={() => void decide("known")} hint="K" disabled={saving}>já conheço</Resposta>
            <Resposta onClick={() => void decide("disliked")} disabled={saving}>não curti</Resposta>
            <Resposta onClick={() => void decide("mismatch")} disabled={saving}>não era o que pedi</Resposta>
            <Resposta onClick={() => void decide("curious")} disabled={saving}>fiquei curioso</Resposta>
            <Resposta onClick={() => void decide("unheard")} disabled={saving}>ainda não ouvi</Resposta>
          </Respostas>
          {Object.values(current.feedback ?? {}).filter((entry) => entry?.type !== "RETRACTED").map((entry) => entry && <p key={entry.id}>
            Você registrou: {FEEDBACK_LABEL[entry.type] ?? "uma resposta anterior"}{entry.note ? ` — ${entry.note}` : ""}.{" "}
            <button className={styles.remove} disabled={saving} type="button" onClick={() => void decide("retract", entry.id)}>retirar esta avaliação</button>
          </p>)}
          {index > 0 && <Resposta onClick={() => void moveTo(index - 1)} disabled={saving}>rever a anterior</Resposta>}
          {index < queue.length - 1 && <Resposta onClick={() => void moveTo(index + 1)} disabled={saving}>próxima sem avaliar</Resposta>}
        </DiscoveryDisclosure>
        <div className={styles.continuity}>
          <p><span>{String(index + 1).padStart(2, "0")}</span> de {String(queue.length).padStart(2, "0")} indicações <span className={styles.continuityNote}>· teu lugar fica guardado</span></p>
          <div>
            <button className={styles.textButton} disabled={busy || saving} onClick={() => void load(proximity, fame, "DEEPEN", { itemId: current.id, intent: intent === "CONNECTIONS" ? "CONNECTIONS" : "DISCOVER" })}>buscar novidades a partir desta faixa ↗</button>
            {index > 0 && <button className={styles.textButton} disabled={saving} onClick={() => void moveTo(index - 1)}>← anterior</button>}
            <button className={styles.textButton} disabled={saving} onClick={() => void load(proximity, fame, "MORE")}>buscar mais nesse caminho ↗</button>
            {intent !== "REPERTOIRE" && <button className={styles.textButton} disabled={saving} onClick={openMap}>ajustar caminho</button>}
          </div>
        </div>
      </div>
    );
  }

  const result = exported && exported !== "running" ? exported : null;

  return (
    <div ref={stageRef} className={styles.stage}>
      <div inert={modalOpen}>
      <div className={styles.pageTools}><span>uma boa música pode abrir outro caminho.</span><button className={styles.textButton} onClick={() => {
        setCollectionOpen(true); requestAnimationFrame(() => document.getElementById("colecao-descoberta")?.scrollIntoView({ behavior: reduced ? "instant" : "smooth" }));
      }}>para depois <span className={styles.pillCount}>{kept.length}</span></button></div>
      {selection.error && <p role="alert">{selection.error} <button className={styles.textButton} onClick={() => void selection.refresh()}>atualizar coleção</button></p>}
      <Link className={styles.textButton} href="/discovery/memory">meus caminhos e respostas →</Link>
      <AnimatePresence mode="wait" initial={false}>
        {scene.identity !== null
          ? <DiscoveryTransition key={scene.key} visit={scene.visit} onReady={scene.onReady}>{top}</DiscoveryTransition>
          : <div key="other">{top}</div>}
      </AnimatePresence>
      <DiscoveryHistory currentSessionId={sessionId} currentRank={index + 1} busy={busy || saving || changing} onResume={(id) => void load(proximity, fame, "RESUME", { sessionId: id })} />

      <DiscoveryDisclosure id="colecao-descoberta" className={styles.collection} bodyClassName={styles.disclosureContent} open={collectionOpen} onOpenChange={setCollectionOpen}
        summary={<><span>Para depois <span className={styles.pillCount}>{kept.length}</span></span><span aria-hidden="true">↘</span></>}>
          <p className={styles.mapNote}>O que você curtiu ou separou para ouvir depois. Essa pilha fica na tua conta, nos teus dispositivos. Remover daqui não retira uma avaliação.</p>
          <a className={styles.textButton} href="/api/collection?download=1">baixar minha coleção (JSON)</a>
          {!selection.ready && !selection.error && <p role="status">Abrindo tua coleção…</p>}
          {selection.localItems.length > 0 && <p className={styles.mapNote}>Há {selection.localItems.length} faixas na lista antiga deste navegador. <button className={styles.textButton} disabled={selection.syncing || !selection.ready} onClick={() => void selection.importLocal()}>trazer para a conta</button></p>}
          {exported && exportHidden && <p className={styles.quiet} role="status">
            {exported === "running" ? "Levando tua lista pro Spotify… " : "A última exportação terminou. "}
            <button type="button" className={styles.remove} onClick={() => setExportHidden(false)}>ver {exported === "running" ? "andamento" : "resultado"}</button>
          </p>}
          {kept.length === 0 ? (
            <p className={styles.quiet}>O que você curtir ou guardar fica aqui, pra levar pro Spotify.</p>
          ) : (
            <>
              <ol className={styles.kept}>
                {kept.map((item) => (
                  <li key={item.id}>
                    <span className={styles.keptTrack}>
                      {item.trackName} <span className={styles.keptHow}>{item.artistName}</span>
                    </span>
                    <span className={styles.keptHow}>{HOW[item.action]}</span>
                    <button type="button" className={styles.remove} disabled={selection.syncing} onClick={() => void selection.remove(item)} aria-label={`Remover ${item.trackName} da lista`}>remover</button>
                  </li>
                ))}
              </ol>
              <Respostas inline label="Levar">
                <Resposta onClick={() => void exportKept()}>levar {kept.length} pro Spotify</Resposta>
              </Respostas>
            </>
          )}
      </DiscoveryDisclosure>
      {intent !== "REPERTOIRE" && <DiscoveryDisclosure id="mapa-descoberta" className={styles.adjustments} bodyClassName={styles.map} open={mapOpen} onOpenChange={setMapOpen}
        summary={<><span><span className={styles.eyebrow}>teu caminho, com mais detalhe</span><strong>Ajustar a descoberta</strong></span><span aria-hidden="true">↘</span></>}>
          <div><h2 className={styles.mapTitle}>Qual é a distância da próxima pista?</h2>
            <p className={styles.mapNote}>Mais perto das tuas referências ou um passo para fora. No outro eixo, o tamanho do público. Os ajustes só valem quando você iniciar a busca.</p>
            <Mapa proximity={draftProximity} fame={draftFame} dots={dots} busy={busy || saving} onChange={move} onCommit={commit} />
            {queue?.some((item) => !item.position) && <p className={styles.quiet}>Sugestões sem dados de público continuam na escuta, mas ficam fora dos pontos.</p>}
          </div><div className={styles.mapAside}>
            <p className={styles.eyebrow}>algumas direções possíveis</p>
            <ul className={styles.corners} aria-label="Direções da descoberta">
              {CORNERS.map((corner) => <li key={corner.label}><button type="button" disabled={busy || saving}
                aria-pressed={corner.proximity === draftProximity && corner.fame === draftFame}
                onClick={() => commit(corner.proximity, corner.fame)}>{corner.label}<span aria-hidden="true">↗</span></button></li>)}
            </ul>
            <p className={styles.mapNote}>As referências continuam vindo do teu repertório. É uma direção para procurar, sem garantia de gênero ou de popularidade.</p>
            <Resposta primary disabled={busy || saving} onClick={() => void load(draftProximity, draftFame, "NEW_ENTRY")}>buscar por aqui →</Resposta>
          </div>
      </DiscoveryDisclosure>}


      {penInPlace && <PenLayer pen={pen} signal={signal} reduced={reduced} />}
      </div>

      {modalOpen && createPortal(
        <div className={styles.overlay}>
          <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="levar-titulo" className={styles.dialog}>
            <h2 id="levar-titulo">
              {exported === "running"
                ? "Levando pro Spotify…"
                : result?.error
                  ? "Não deu pra levar."
                  : `Achei ${result?.resolvedCount ?? 0} de ${result?.totalItems ?? kept.length}.`}
            </h2>
            {exported === "running" && <p>Tô procurando cada uma no catálogo do Spotify.</p>}
            {result?.error && <p data-kind="erro">{result.error}</p>}
            {result && !result.error && (
              <p>
                {result.mode === "SPOTIFY_API"
                  ? result.partial
                    ? `A playlist foi criada, mas só ${result.addedCount ?? 0} faixas foram adicionadas. Parte do envio falhou.`
                    : "A playlist já tá na tua conta."
                  : "Baixa a lista e abre no teu player, ou conecta o Spotify em ajustes pra eu criar a playlist direto."}
              </p>
            )}
            <Respostas inline label="Depois de levar">
              {result?.playlistUrl && <Resposta href={result.playlistUrl}>abrir no Spotify</Resposta>}
              {result?.m3uPayload && <Resposta onClick={() => downloadM3u(result)}>baixar .m3u</Resposta>}
              <Resposta onClick={() => setExportHidden(true)}>fechar</Resposta>
            </Respostas>
          </div>
        </div>, document.body
      )}
    </div>
  );
}
