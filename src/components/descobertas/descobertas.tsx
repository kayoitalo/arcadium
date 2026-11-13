"use client";

import { privateFetch } from "@/lib/http/private-fetch";
import Link from "next/link";

import { AnimatePresence, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { RepertoireFilter, TerritoryDoors } from "./exploration-doors";
import type { TerritoryRequest, RepertoireRestriction, DiscoveryCoverage } from "@/modules/recommendations/domain/territories";
import { DiscoveryEntry } from "./discovery-entry";
import { DiscoveryTrack } from "./discovery-track";
import { AlbumProgress } from "./album-journeys";
import { TrackDrawer } from "./track-drawer";
import { RumoMenu, type RumoItem } from "./rumo-menu";
import { discoveryEntryLabel } from "./discovery-view";
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
  scoreComponents?: { albumEdition?: { disc: number; number: number } };
}

type Action = "liked" | "saved" | "known" | "skipped" | "disliked" | "mismatch" | "curious" | "unheard";
type LoadOperation = "BOOTSTRAP" | "RESUME" | "MORE" | "NEW_ENTRY" | "DEEPEN";
type SearchOptions = { intent?: DiscoveryIntent; itemId?: string; sessionId?: string; territory?: TerritoryRequest; restrictions?: RepertoireRestriction };
type Journey = DiscoveryContext["journey"] & { rootSessionId: string };

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
  { label: "relações menos diretas", proximity: 18, fame: 30 },
  { label: "como nunca ouvi isso?", proximity: 62, fame: 92 },
];

/**
 * Pra ouvir depois. Ele indica uma faixa por vez, dizendo de onde tirou
 * a ideia; você ouve ali mesmo e responde. Tocando, a corda dele abraça a
 * capa e vibra com o som. Embaixo, o mapa que decide onde ele procura, e
 * o que você separou para levar.
 */
export function Descobertas({ initialSessionId = null }: {
  initialSessionId?: string | null;
} = {}) {
  const reduced = Boolean(useReducedMotion());
  const [proximity, setProximity] = useState(55);
  const [fame, setFame] = useState(50);
  const [draftProximity, setDraftProximity] = useState(55);
  const [draftFame, setDraftFame] = useState(50);
  const [choosing, setChoosing] = useState(true);
  const [mediaState, setMediaState] = useState("idle");
  const [mediaAttempt, setMediaAttempt] = useState(0);
  const [mapOpen, setMapOpen] = useState(false);
  const [territoryOpen, setTerritoryOpen] = useState(false);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const [queue, setQueue] = useState<Candidate[] | null>(null);
  const [index, setIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [intent, setIntent] = useState<DiscoveryIntent | null>(null);
  const intentRef = useRef<DiscoveryIntent>("DISCOVER");
  const [coverage, setCoverage] = useState<DiscoveryCoverage | null>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const [restrictions, setRestrictions] = useState<RepertoireRestriction | undefined>();
  const [journey, setJourney] = useState<Journey | null>(null);
  const weeklyHref = journey?.weekly ? `/discovery/week?semana=${encodeURIComponent(journey.weekly.journeyId)}` : null;
  const [busy, setBusy] = useState(true);
  const [failed, setFailed] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  /** A gaveta aberta no pé da escuta: outras respostas ou o que há sobre a faixa. */
  const [panel, setPanel] = useState<"mais" | "sobre" | null>(null);
  const [aspects, setAspects] = useState<string[]>([]);
  const suggestionRef = useRef<HTMLElement>(null);
  const sessionRef = useRef<string | null>(null);
  const pendingSearch = useRef<{ signature: string; key: string } | null>(null);
  const lastLoad = useRef<{ proximity: number; fame: number; operation: LoadOperation; options?: SearchOptions }>({ proximity: 55, fame: 50, operation: "BOOTSTRAP" });
  const pendingFeedback = useRef<{ signature: string; key: string } | null>(null);
  const [decided, setDecided] = useState<Record<string, Action>>({});
  const [saving, setSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const selection = useSelection();
  const kept = selection.items;
  const requestRef = useRef(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const sound = useSound((url) => {
    if (current?.previewUrl === url && scene.ready && sessionId) void privateFetch("/api/discovery-events", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: current.id, requestKey: crypto.randomUUID() }),
    }).catch(() => undefined);
  });
  const { stop, toggle } = sound;
  const signal = usePulse(stageRef, sound.playing, sound.read);

  const applySession = useCallback((payload: { items?: Candidate[]; sessionId?: string; currentRank?: number; coverage?: DiscoveryCoverage | null; journey?: Journey | null; settings?: { destination?: { genre: string }; restrictions?: RepertoireRestriction; intent?: DiscoveryIntent | null; dials?: { proximity: number; fame: number } } }) => {
    const items = payload.items ?? [];
    setQueue(items); setSessionId(payload.sessionId ?? null);
    sessionRef.current = payload.sessionId ?? null;
    setIntent(payload.settings?.intent ?? null); intentRef.current = payload.settings?.intent ?? "DISCOVER";
    setJourney(payload.journey ?? null); setCoverage(payload.coverage ?? null); setDestination(payload.settings?.destination?.genre ?? null);
    setRestrictions(payload.settings?.restrictions);
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
      const signature = JSON.stringify([action, source, nextProximity, nextFame, nextIntent, options.itemId, options.territory, options.restrictions]);
      if (pendingSearch.current?.signature !== signature) pendingSearch.current = { signature, key: crypto.randomUUID() };
      response = await privateFetch("/api/recommendations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation: action, sessionId: source, requestKey: pendingSearch.current.key,
          intent: nextIntent, sourceItemId: options.itemId, territory: options.territory, restrictions: options.restrictions,
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
    if (!scene.ready || choosing || busy || !current || !headlineRef.current) return;
    const headline = headlineRef.current;
    headline.tabIndex = -1;
    headline.focus({ preventScroll: true });
    const rect = headline.getBoundingClientRect();
    if (rect.top < 90 || rect.top > window.innerHeight / 2) headline.scrollIntoView({ behavior: reduced ? "instant" : "smooth", block: "start" });
  }, [current?.id, choosing, busy, scene.ready, scene.visit, reduced]);

  useEffect(() => { setNote(""); setAspects([]); setPanel(null); }, [current?.id]);

  // Esc fecha a gaveta aberta no pé da escuta e devolve o foco a quem abriu
  useEffect(() => {
    if (!panel) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const opener = document.querySelector<HTMLElement>(`[aria-controls="${panel === "mais" ? "outras-respostas" : "sobre-a-faixa"}"]`);
      setPanel(null);
      opener?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  useEffect(() => {
    const element = suggestionRef.current;
    if (!scene.ready || !element || !current || !sessionId || busy || choosing || !("IntersectionObserver" in window)) return;
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
  }, [current?.id, sessionId, busy, choosing, scene.ready, scene.visit]);

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
    if (!scene.ready || !current || choosing || busy) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, details, button, a, [role='group']")) return;
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
  }, [current, decide, choosing, busy, toggleSound, scene.ready]);

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
      <DiscoveryEntry busy={busy || saving} hasSession={Boolean(sessionId)} currentRank={index + 1} total={queue?.length ?? 0}
        onChoose={(nextProximity, nextFame, nextIntent) => void load(nextProximity, nextFame, "NEW_ENTRY", { intent: nextIntent })}
        onResume={() => void load(proximity, fame, "RESUME")}
        territoryOpen={territoryOpen} onTerritory={() => setTerritoryOpen((open) => !open)}
        territory={<TerritoryDoors busy={busy || saving} onTerritory={(territory) => void load(55, 50, "NEW_ENTRY", { intent: "TERRITORY", territory })} />} />
      {busy && <p className={styles.quiet} role="status">Procurando tua última busca…</p>}
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
    top = <Aviso window="seguindo as tuas pistas" headline="Peraí. Tua próxima descoberta está a caminho." narrative="Tô cruzando tuas referências. Já volto com a primeira." />;
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
        window="nesse caminho"
        headline={intent === "REPERTOIRE" ? "Não achei nada nesse recorte." : "Nada novo nesse canto."}
        narrative={intent === "REPERTOIRE" ? "Nada do que já tocou cabe nesse filtro. Dá pra afrouxar o recorte ou ir por outro caminho." : "Dessa vez as tuas referências não renderam indicação. A gente tenta por outro lado."}
      >{journey?.parentSessionId && <Resposta onClick={() => void load(proximity, fame, "RESUME", { sessionId: journey.parentSessionId })}>voltar ao passo anterior</Resposta>}
        <Resposta onClick={showEntries}>escolher outro caminho</Resposta>{intent !== "REPERTOIRE" && intent !== "TERRITORY" && <Resposta onClick={openMap}>ajustar a busca</Resposta>}</Aviso>
    );
  } else if (finished || !current) {
    top = (
      <Aviso
        window="fim do caminho"
        headline={intent === "ALBUM" ? "Chegamos à última faixa desta edição." : kept.length > 0 ? `Você separou ${kept.length}.` : "Chegamos ao fim desta busca."}
        narrative={
          kept.length > 0
            ? "Tua pilha para depois está aqui. Dá para levar pro Spotify ou continuar descobrindo."
            : "A gente pode seguir essas pistas ou escolher outro caminho."
        }
      >
        {kept.length > 0 && <Resposta href="/discovery/collection">ver tuas {kept.length} faixas separadas →</Resposta>}
        {intent !== "ALBUM" && !weeklyHref && <Resposta onClick={() => void load(proximity, fame, "MORE")}>busca mais nesse canto</Resposta>}
        {weeklyHref && <Resposta href={weeklyHref}>voltar à jornada da semana →</Resposta>}
        <Resposta onClick={showEntries}>escolher outro caminho</Resposta>
        {index > 0 && <Resposta onClick={() => void moveTo(index - 1)}>rever a anterior</Resposta>}
      </Aviso>
    );
  } else {
    const pad = (value: number) => String(value).padStart(2, "0");
    const entryLabel = discoveryEntryLabel(proximity, intent);
    const where = weeklyHref ? "da semana" : entryLabel;
    // tudo que muda o caminho mora num menu só: a faixa fica com a frente livre
    const rumo: RumoItem[] = [
      ...(weeklyHref ? [{ label: "voltar à jornada da semana", arrow: "→" as const, href: weeklyHref }] : []),
      ...(journey?.parentSessionId ? [{ label: "voltar ao passo anterior", arrow: "←" as const, disabled: busy || saving,
        onSelect: () => void load(proximity, fame, "RESUME", { sessionId: journey.parentSessionId }) }] : []),
      { label: "buscar novidades a partir desta faixa", arrow: "→", disabled: busy || saving,
        onSelect: () => void load(proximity, fame, "DEEPEN", { itemId: current.id, intent: intent === "CONNECTIONS" ? "CONNECTIONS" : "DISCOVER" }) },
      ...(intent !== "ALBUM" && !weeklyHref ? [{ label: "buscar mais nesse caminho", arrow: "→" as const, disabled: saving,
        onSelect: () => void load(proximity, fame, "MORE") }] : []),
      ...(intent !== "REPERTOIRE" && intent !== "ALBUM" && intent !== "TERRITORY" && !weeklyHref
        ? [{ label: "ajustar distância e público", arrow: "↓" as const, disabled: saving, onSelect: openMap }] : []),
      { label: "escolher outro caminho", arrow: "→", away: true, onSelect: showEntries },
      ...(index > 0 ? [{ label: "rever a anterior", arrow: "←" as const, away: true, disabled: saving, onSelect: () => void moveTo(index - 1) }] : []),
    ];
    const anchorNote = journey?.parentSessionId
      ? journey.anchor ? <>Este caminho parte de “{journey.anchor.trackName}”, de {journey.anchor.artistName}.</> : "Este passo continua uma busca anterior."
      : null;
    const elsewhere = `https://open.spotify.com/search/${encodeURIComponent(`${current.artistName} ${current.trackName}`)}`;
    top = (
      <div>
        {journey?.album && <AlbumProgress album={journey.album} curation={journey.curation} tracks={queue} index={index} disabled={saving || busy || changing} onMove={(position) => void moveTo(position)} />}
        <DiscoveryTrack title={current.trackName} artist={current.artistName} reason={current.reason}
          sectionRef={suggestionRef} headlineRef={headlineRef} markRef={markRef} marked={penInPlace && pen.started.has("grifo:" + current.id)}
          inAlbum={intent === "ALBUM"} repertoire={intent === "REPERTOIRE"}
          context={<>
            <p className={styles.eyebrow}>{where}{current.isRevisit && " · uma revisita"} · <span className={styles.position}>{pad(index + 1)}</span> de {pad(queue.length)}</p>
            <RumoMenu items={rumo} note={anchorNote} />
          </>}
          onPlay={toggleSound} canPlay={Boolean(current.previewUrl)} playing={sound.playing} loading={sound.loading || mediaState === "loading"}
          listenElsewhere={<>
            <a className={styles.textButton} href={elsewhere} target="_blank" rel="noreferrer">ouvir no Spotify ↗</a>
            {current.appleMusicUrl && <a className={styles.textButton} href={current.appleMusicUrl} target="_blank" rel="noreferrer">no Apple Music ↗</a>}
            {mediaState === "error" && <button className={styles.textButton} onClick={() => setMediaAttempt((value) => value + 1)}>procurar o trecho de novo</button>}
          </>}
          artwork={<Capa cover={{ url: current.coverUrl, title: current.albumName ?? current.trackName, artist: current.artistName }} playing={sound.playing} innerRef={coverRef} className={styles.cover} eager glow />}
          metadata={<>{current.albumName && <span>{current.albumName} · </span>}{current.genre && <span>{genreLabel(current.genre)}</span>}
            {current.previewUrl && current.appleMusicUrl && <> · <a href={current.appleMusicUrl} target="_blank" rel="noreferrer">Apple Music ↗</a></>}
            {current.sourceUrl && <> · <a href={current.sourceUrl} target="_blank" rel="noreferrer">referência no Last.fm ↗</a></>}
          </>} />
        <div className={styles.decisionBar}>
        <Respostas>
          {panel === "mais" && <div id="outras-respostas" className={`${styles.review} ${styles.dockPanel}`} role="group" aria-label="Outras respostas">
            <fieldset disabled={saving}>
              <legend>Quer contar o que chamou atenção? É opcional e vai junto com a resposta.</legend>
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
            {index < queue.length - 1 && <button type="button" className={styles.textButton} onClick={() => void moveTo(index + 1)} disabled={saving}>próxima sem responder →</button>}
          </div>}
          {panel === "sobre" && <div id="sobre-a-faixa" className={styles.dockPanel}>
            <TrackDrawer itemId={current.id} albumName={current.albumName} mediaReady={mediaState === "ready"}
              albumHref={current.albumName && intent !== "ALBUM" ? `/discovery/albums?item=${encodeURIComponent(current.id)}` : null} />
          </div>}
          <p className={styles.feedback} role={feedbackError || sound.error ? "alert" : "status"}>
            {feedbackError || sound.error || (saving ? "Guardando tua resposta…" : kept.length > 0
              ? <Link href="/discovery/collection">{kept.length === 1 ? "1 faixa separada" : `${kept.length} faixas separadas`} pra depois →</Link>
              : "O que você guardar fica pra depois, mesmo trocando de caminho.")}
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
          <Resposta onClick={() => setPanel((open) => open === "mais" ? null : "mais")} expanded={panel === "mais"} controls="outras-respostas">
            mais…
          </Resposta>
          <button type="button" className={styles.dockToggle} aria-expanded={panel === "sobre"} aria-controls="sobre-a-faixa"
            onClick={() => setPanel((open) => open === "sobre" ? null : "sobre")}>sobre essa faixa <span aria-hidden="true">{panel === "sobre" ? "↑" : "↓"}</span></button>
        </Respostas>
        </div>
      </div>
    );
  }


  return (
    <div ref={stageRef} className={styles.stage}>
      <div>
      {!choosing && destination && <p className={styles.journeyContext}>Destino: {destination}.</p>}
      {!choosing && intent === "REPERTOIRE" && restrictions && (restrictions.albumGenre || restrictions.maxDurationMs) && <p className={styles.journeyContext}>
        Teu recorte: {[
          restrictions.albumGenre && `discos de ${restrictions.albumGenre}`,
          restrictions.maxDurationMs && `faixas de até ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(restrictions.maxDurationMs / 60000)} min`,
        ].filter(Boolean).join(", ")}.
      </p>}
      {!choosing && coverage?.status === "INSUFFICIENT" && <p className={styles.journeyContext} role="status">
        {coverage.selected === 0 ? "Não achei nada que coubesse no pedido." : `Achei só ${coverage.selected} de ${coverage.requested} que cabem no pedido.`} Preferi não completar com outra coisa.</p>}
      {!choosing && Boolean(coverage?.provider?.failures || coverage?.provider?.deadlineStops) && <p className={styles.journeyContext}>Parte da busca não respondeu a tempo. Pode ter mais coisa por lá.</p>}
      {selection.error && <p role="alert">{selection.error} <Link href="/discovery/collection">abrir tua coleção</Link></p>}
      <AnimatePresence mode="wait" initial={false}>
        {scene.identity !== null
          ? <DiscoveryTransition key={scene.key} visit={scene.visit} onReady={scene.onReady}>{top}</DiscoveryTransition>
          : <div key="other">{top}</div>}
      </AnimatePresence>

      {(choosing || (intent !== "REPERTOIRE" && intent !== "ALBUM" && intent !== "TERRITORY" && !weeklyHref)) && <DiscoveryDisclosure id="mapa-descoberta" className={styles.adjustments} bodyClassName={styles.map} open={mapOpen} onOpenChange={setMapOpen}
        summary={<><strong>ajustar o caminho</strong><span aria-hidden="true">↓</span></>}>
          <div><h2 className={styles.mapTitle}>Qual é a distância da próxima pista?</h2>
            <p className={styles.mapNote}>Mais perto das tuas referências ou um passo pra fora. No outro eixo, quanta gente já conhece.</p>
            <Mapa proximity={draftProximity} fame={draftFame} dots={dots} busy={busy || saving} onChange={move} onCommit={commit} />
          </div><div className={styles.mapAside}>
            <ul className={styles.corners} aria-label="Direções da descoberta">
              {CORNERS.map((corner) => <li key={corner.label}><button type="button" disabled={busy || saving}
                aria-pressed={corner.proximity === draftProximity && corner.fame === draftFame}
                onClick={() => commit(corner.proximity, corner.fame)}>{corner.label}<span aria-hidden="true">→</span></button></li>)}
            </ul>
            <Resposta primary disabled={busy || saving} onClick={() => void load(draftProximity, draftFame, "NEW_ENTRY", { intent: choosing || !intent ? "DISCOVER" : intent })}>buscar por aqui →</Resposta>
            {choosing && <RepertoireFilter busy={busy || saving} onRepertoire={(next) => void load(85, 75, "NEW_ENTRY", { intent: "REPERTOIRE", restrictions: next })} />}
          </div>
      </DiscoveryDisclosure>}


      {penInPlace && <PenLayer pen={pen} signal={signal} reduced={reduced} />}
      </div>


    </div>
  );
}
