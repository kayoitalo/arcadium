"use client";

import { useReducedMotion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { band, dimension, strike, type Box, type Point, type TextLine } from "../gestures";
import type { StudyCover, StudyMoment } from "../moments";
import { Trace, type TraceGesture, type TracePlan, type WaveSpec } from "../trace";
import { useStudyAudio, type AudioStep } from "../use-study-audio";
import styles from "./fio.module.css";

/*
 * Estudo v2 — o fio da conversa.
 *
 * O que muda em relação à v1:
 * - não há cartões: a conversa é um fio que se rola e se revisita. O
 *   assunto da vez é o que está no meio da tela; o que ele já disse fica,
 *   mais apagado, e o que você mandou esquecer fica riscado;
 * - a prova está sempre na tela, em repouso (cinza, parada). O amigo não a
 *   revela: acende o pedaço que importa;
 * - o gesto é exato: faixa na altura das letras, régua em cima da barra do
 *   dado, cota de desenho técnico entre duas capas, risco reto de revisor.
 *   A anotação mora na grade, reta.
 *
 * Continua igual: um narrador só, uma cor só (a dele), a música como o
 * único outro dono do movimento, e nada disso persiste — é estudo.
 */

type Part = "block" | "headline" | "mark" | "from" | "to" | "bar";

interface Note {
  id: string;
  /** O gesto que, ao terminar, libera a anotação. */
  gesture: string;
  text: string;
  x: number;
  y: number;
  kind: "grito" | "dado";
  align: "center" | "end";
  dim: boolean;
}

const END = {
  window: "",
  headline: "Por hoje é isso.",
  narrative: "Volta semana que vem. Até lá eu já reparei em outra coisa.",
};

const REPLY = "Justo. Finge que eu não falei nada.";

function boxOf(element: Element, origin: DOMRect): Box {
  const rect = element.getBoundingClientRect();
  return { left: rect.left - origin.left, top: rect.top - origin.top, width: rect.width, height: rect.height };
}

/** A manchete e o trecho grifado: o fim da frase, sem palavra de uma ou duas letras sozinha. */
function splitTail(text: string): { plain: string; tail: string } {
  const words = text.split(/\s+/).filter(Boolean);
  const marks = words.length >= 3 && words[words.length - 2].replace(/[^\p{L}\p{N}]/gu, "").length > 2 ? 2 : 1;
  return { plain: words.slice(0, words.length - marks).join(" "), tail: words.slice(words.length - marks).join(" ") };
}

/** Nome curto para caber na anotação: sem "(The Remaster)", sem "(feat. …)". */
function shorten(text: string, max = 18): string {
  const bare = text.replace(/\s*[([].*?[)\]]/g, "").trim() || text;
  return bare.length > max ? `${bare.slice(0, max - 1).trimEnd()}…` : bare;
}

/**
 * Onde ficam as maiúsculas e a linha de base de cada linha de um trecho.
 * A caixa que o navegador devolve é a da linha inteira; a faixa exata
 * precisa da métrica da fonte, que o canvas mede com a própria fonte.
 */
function textLines(element: HTMLElement, origin: DOMRect): { lines: TextLine[]; size: number } {
  const style = getComputedStyle(element);
  const size = Number.parseFloat(style.fontSize);
  let ascent = size * 0.88;
  let cap = size * 0.7;
  const context = document.createElement("canvas").getContext("2d");
  if (context) {
    context.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
    const probe = context.measureText("H");
    if (probe.fontBoundingBoxAscent) ascent = probe.fontBoundingBoxAscent;
    if (probe.actualBoundingBoxAscent) cap = probe.actualBoundingBoxAscent;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  // um retângulo por pedaço de texto: os da mesma linha viram uma linha só
  const rows: Array<{ left: number; right: number; top: number }> = [];
  for (const rect of Array.from(range.getClientRects())) {
    if (rect.width < 1) continue;
    const row = rows.find((candidate) => Math.abs(candidate.top - rect.top) < 3);
    if (row) {
      row.left = Math.min(row.left, rect.left);
      row.right = Math.max(row.right, rect.right);
    } else {
      rows.push({ left: rect.left, right: rect.right, top: rect.top });
    }
  }

  const lines = rows
    .sort((a, b) => a.top - b.top)
    .map((row) => {
      const baseline = row.top - origin.top + ascent;
      return { left: row.left - origin.left, right: row.right - origin.left, capTop: baseline - cap, baseline };
    });
  return { lines, size };
}

/** Duas medidas da mesma pose que caem no mesmo lugar, a um pixel e pouco. */
function sameGeometry(a: TracePlan, b: TracePlan): boolean {
  const ends = (plan: TracePlan) => [
    ...plan.gestures.flatMap((gesture) => gesture.strokes.flatMap((stroke) => [stroke[0], stroke[stroke.length - 1]])),
    ...(plan.wave ? [plan.wave.base[0], plan.wave.base[plan.wave.base.length - 1]] : []),
  ];
  const [left, right] = [ends(a), ends(b)];
  return (
    left.length === right.length &&
    left.every((point, index) => Math.abs(point.x - right[index].x) < 1.5 && Math.abs(point.y - right[index].y) < 1.5)
  );
}

function Cover({
  cover,
  playing,
  innerRef,
}: {
  cover: StudyCover;
  playing: boolean;
  innerRef?: (node: HTMLDivElement | null) => void;
}) {
  return (
    <div ref={innerRef} className={styles.cover} data-playing={playing}>
      {cover.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover.url} alt={`${cover.title}, de ${cover.artist}`} draggable={false} />
      ) : (
        <span className={styles.coverEmpty}>{cover.title}</span>
      )}
    </div>
  );
}

export function Fio({ moments }: { moments: StudyMoment[] }) {
  const reduced = Boolean(useReducedMotion());
  const { play, stop, read, playing, step } = useStudyAudio();
  // o fim também é um bloco do fio
  const total = moments.length + 1;

  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState<number[]>([0]);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [plan, setPlan] = useState<TracePlan | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  // só cresce: gesto que terminou uma vez deixa a anotação dele na tela
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const [marked, setMarked] = useState<Set<number>>(() => new Set());
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [cut, setCut] = useState(0);

  const stageRef = useRef<HTMLElement>(null);
  const parts = useRef(new Map<string, HTMLElement>());
  const planRef = useRef<TracePlan | null>(null);
  const signal = useRef<ArrayLike<number> | null>(null);
  const dismissTimer = useRef(0);

  const register = useCallback(
    (index: number, part: Part) => (node: HTMLElement | null) => {
      const key = `${index}:${part}`;
      if (node) parts.current.set(key, node);
      else parts.current.delete(key);
    },
    [],
  );

  const evidenceOf = useCallback((index: number) => moments[index]?.evidence ?? null, [moments]);

  const activeEvidence = evidenceOf(active);
  const steps = useMemo<AudioStep[]>(() => {
    if (!activeEvidence) return [];
    if (activeEvidence.kind === "transition") {
      return [
        ...(activeEvidence.from.previewUrl ? [{ url: activeEvidence.from.previewUrl, seconds: 6.5 }] : []),
        ...(activeEvidence.to.previewUrl ? [{ url: activeEvidence.to.previewUrl }] : []),
      ];
    }
    return activeEvidence.previewUrl ? [{ url: activeEvidence.previewUrl }] : [];
  }, [activeEvidence]);
  const playingSide: "from" | "to" | null = playing ? (step === 0 && steps.length > 1 ? "from" : "to") : null;

  const pose = `${seen.join(",")}|${active}|${dismissed.join(",")}|${expanded.join(",")}|${playing ? "som" : ""}`;

  // ---------- onde o traço vai ----------

  const measure = useCallback(
    (instant: boolean) => {
      const stage = stageRef.current;
      if (!stage) return;
      const origin = stage.getBoundingClientRect();
      const thin = Math.max(1.5, Math.min(2.5, origin.width / 600));
      const gestures: TraceGesture[] = [];
      const nextNotes: Note[] = [];
      let wave: WaveSpec | null = null;

      for (const index of seen) {
        const dim = index !== active;
        const headline = parts.current.get(`${index}:headline`);
        const mark = parts.current.get(`${index}:mark`);

        if (dismissed.includes(index)) {
          if (headline) {
            const { lines, size: fontSize } = textLines(headline, origin);
            gestures.push({
              id: `${index}:risco`,
              layer: "over",
              strokes: strike(lines, fontSize),
              width: Math.max(2, fontSize * 0.055),
              cap: "butt",
              dim,
            });
          }
          continue;
        }

        if (mark) {
          const { lines, size: fontSize } = textLines(mark, origin);
          if (lines.length > 0) {
            const { strokes, width } = band(lines, fontSize);
            gestures.push({ id: `${index}:grifo`, layer: "under", strokes, width, cap: "butt", dim });
          }
        }

        const evidence = evidenceOf(index);
        const live = playing && index === active;

        if (evidence?.kind === "transition") {
          const from = parts.current.get(`${index}:from`);
          const to = parts.current.get(`${index}:to`);
          if (from && to) {
            const fromBox = boxOf(from, origin);
            const lift = Math.min(96, Math.max(52, fromBox.height * 0.42));
            const { posts, span, mid } = dimension(fromBox, boxOf(to, origin), lift);
            // com som, o trecho de cima vira corda: as colunas ficam, a travessa vibra
            gestures.push({
              id: `${index}:cota`,
              layer: "over",
              strokes: live ? posts : [posts[0], span, posts[1]],
              width: thin,
              cap: "square",
              join: "miter",
              dim,
            });
            if (live) {
              wave = {
                base: span,
                amp: Math.min(40, lift * 0.55),
                inPlace: true,
                // só para baixo: para cima ela passaria pelo "PAM."
                outwardFrom: { x: mid.x, y: mid.y - 1000 },
                width: thin,
                cap: "square",
              };
            }
            nextNotes.push({ id: `${index}:pam`, gesture: `${index}:cota`, text: "PAM.", x: mid.x, y: mid.y - 12, kind: "grito", align: "center", dim });
            nextNotes.push({
              id: `${index}:intervalo`,
              gesture: `${index}:cota`,
              text: `${evidence.gapMinutes} min depois`,
              x: posts[1][0].x - 12,
              y: mid.y + 10,
              kind: "dado",
              align: "end",
              dim,
            });
          }
        } else if (evidence?.kind === "mostPlayed") {
          const bar = parts.current.get(`${index}:bar`);
          if (bar) {
            const box = boxOf(bar, origin);
            const y = box.top + box.height / 2;
            const base: Point[] = [
              { x: box.left, y },
              { x: box.left + box.width, y },
            ];
            // a régua do amigo é a própria barra do dado, na cor dele
            if (live) {
              // numa lista a folga é curta: a corda desce pouco e nunca alcança a anotação
              wave = { base, amp: 7, inPlace: true, outwardFrom: { x: box.left, y: y - 1000 }, width: box.height + 1, cap: "butt" };
            } else {
              gestures.push({ id: `${index}:regua`, layer: "over", strokes: [base], width: box.height + 1, cap: "butt", dim });
            }
          }
        }
      }

      const candidate: TracePlan = { key: pose, gestures, wave, instant };
      const previous = planRef.current;
      if (instant && previous?.key === pose && sameGeometry(previous, candidate)) return;
      planRef.current = candidate;
      setNotes(nextNotes);
      setPlan(candidate);
    },
    [active, dismissed, evidenceOf, playing, pose, seen],
  );
  const measureRef = useRef(measure);
  measureRef.current = measure;

  useEffect(() => {
    const timer = window.setTimeout(() => measureRef.current(false), planRef.current ? 60 : 380);
    return () => window.clearTimeout(timer);
  }, [pose]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let timer = 0;
    const remeasure = () => {
      if (planRef.current) measureRef.current(true);
    };
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
      window.clearTimeout(timer);
      timer = window.setTimeout(remeasure, 140);
    });
    observer.observe(stage);
    void document.fonts?.ready.then(remeasure);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, []);

  const onGesture = useCallback((id: string, moment: "start" | "end") => {
    const [index, kind] = id.split(":");
    if (kind === "grifo" && moment === "start") setMarked((current) => new Set(current).add(Number(index)));
    if (moment === "end") setDone((current) => (current.has(id) ? current : new Set(current).add(id)));
  }, []);

  // ---------- o assunto da vez ----------

  // o bloco que cruza o meio da tela é o assunto; quem já passou por ali fica no fio
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number((entry.target as HTMLElement).dataset.index);
          setActive(index);
          setSeen((current) => (current.includes(index) ? current : [...current, index]));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (let index = 0; index < total; index += 1) {
      const block = parts.current.get(`${index}:block`);
      if (block) observer.observe(block);
    }
    return () => observer.disconnect();
  }, [total]);

  // mudou de assunto, a música daquele assunto para
  useEffect(() => {
    stop();
  }, [active, stop]);

  // o pulso: um quadro lê o sinal uma vez e serve a capa e a corda
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (!playing) {
      stage.style.setProperty("--level", "0");
      signal.current = null;
      return;
    }
    let frame = 0;
    const loop = () => {
      const { signal: now, level } = read();
      signal.current = now;
      stage.style.setProperty("--level", level.toFixed(3));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playing, read]);

  // o corte seco da transição: o "PAM." grita de novo
  useEffect(() => {
    if (playing && step > 0) setCut((current) => current + 1);
  }, [playing, step]);

  // ---------- respostas ----------

  const go = useCallback(
    (index: number) => {
      const target = parts.current.get(`${Math.max(0, Math.min(total - 1, index))}:block`);
      target?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    },
    [reduced, total],
  );

  const toggleSound = useCallback(() => {
    if (steps.length === 0 || dismissed.includes(active)) return;
    if (playing) stop();
    else play(steps);
  }, [active, dismissed, play, playing, steps, stop]);

  const toggleMore = useCallback(() => {
    if (!evidenceOf(active) || dismissed.includes(active)) return;
    setExpanded((current) => (current.includes(active) ? current.filter((index) => index !== active) : [...current, active]));
  }, [active, dismissed, evidenceOf]);

  const dismiss = useCallback(() => {
    if (active >= moments.length || dismissed.includes(active)) return;
    stop();
    setDismissed((current) => [...current, active]);
    setMarked((current) => {
      const next = new Set(current);
      next.delete(active);
      return next;
    });
    window.clearTimeout(dismissTimer.current);
    dismissTimer.current = window.setTimeout(() => go(active + 1), 1400);
  }, [active, dismissed, go, moments.length, stop]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "arrowright" || key === "enter") {
        event.preventDefault();
        go(active >= total - 1 ? 0 : active + 1);
      } else if (key === "arrowleft") {
        event.preventDefault();
        go(active - 1);
      } else if (key === "t" || key === " ") {
        event.preventDefault();
        toggleSound();
      } else if (key === "m") toggleMore();
      else if (key === "n") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, dismiss, go, toggleMore, toggleSound, total]);

  useEffect(() => () => window.clearTimeout(dismissTimer.current), []);

  if (moments.length === 0) {
    return (
      <main className={styles.stage}>
        <header className={styles.bar}>
          <span className={styles.wordmark}>arcadium</span>
        </header>
        <section className={styles.block}>
          <h1 className={styles.headline}>Ainda não tenho nada pra te contar.</h1>
        </section>
      </main>
    );
  }

  const atEnd = active >= moments.length;
  const activeDismissed = dismissed.includes(active);

  return (
    <main ref={stageRef} className={styles.stage}>
      <h1 className={styles.hidden}>Arcadium — estudo de linguagem v2</h1>
      <header className={styles.bar}>
        <div>
          <span className={styles.wordmark}>arcadium</span>
          <span className={styles.study}>estudo de linguagem</span>
        </div>
        <nav className={styles.versions} aria-label="Versão do estudo">
          <Link href="/estudo">v1</Link>
          <span aria-current="page">v2</span>
        </nav>
      </header>

      <div className={styles.thread}>
        {[...moments, null].map((moment, index) => {
          const talk = moment ?? END;
          const { plain, tail } = splitTail(talk.headline);
          const evidence = moment?.evidence ?? null;
          const isDismissed = dismissed.includes(index);
          const isExpanded = expanded.includes(index);
          return (
            <section
              key={moment?.key ?? "fim"}
              ref={register(index, "block")}
              data-index={index}
              className={styles.block}
              data-active={index === active}
              data-dismissed={isDismissed}
              data-end={!moment}
              aria-current={index === active ? "step" : undefined}
            >
              <div className={styles.voice}>
                {talk.window && <p className={styles.window}>{talk.window}</p>}
                <h2 ref={register(index, "headline")} className={styles.headline}>
                  {plain}
                  {plain && " "}
                  <span ref={register(index, "mark")} className={styles.mark} data-marked={marked.has(index)}>
                    {tail}
                  </span>
                </h2>
                <p className={isDismissed ? styles.reply : styles.narrative}>{isDismissed ? REPLY : talk.narrative}</p>
                {moment && !isDismissed && (
                  <div className={styles.aside}>
                    <p className={styles.insight}>{moment.insight}</p>
                    {moment.closing && <p className={styles.closing}>{moment.closing}</p>}
                  </div>
                )}
              </div>

              {evidence?.kind === "transition" && (
                <div className={styles.proof}>
                  <div className={styles.pair}>
                    {(["from", "to"] as const).map((side) => {
                      const entry = evidence[side];
                      return (
                        <figure className={styles.side} data-side={side} key={side}>
                          <Cover
                            cover={entry.cover}
                            playing={index === active && playingSide === side}
                            innerRef={register(index, side)}
                          />
                          <figcaption className={styles.caption}>
                            <span className={styles.when}>{entry.when}</span>
                            <span className={styles.track}>{entry.track}</span>
                            <span className={styles.who}>
                              {entry.artist}
                              {entry.genre ? ` · ${entry.genre}` : ""}
                            </span>
                          </figcaption>
                        </figure>
                      );
                    })}
                  </div>
                  {isExpanded && (
                    <ol className={styles.sequence} aria-label="O que tocou antes e depois">
                      {[
                        ...evidence.context.before.map((entry) => ({ ...entry, jump: false })),
                        { ...evidence.from, jump: true },
                        { ...evidence.to, jump: true },
                        ...evidence.context.after.map((entry) => ({ ...entry, jump: false })),
                      ].map((entry, order) => (
                        <li key={`${entry.when}-${order}`} data-jump={entry.jump}>
                          <span className={styles.when}>{entry.when.split(" · ")[1] ?? entry.when}</span>
                          <span className={styles.sequenceTrack}>{entry.track}</span>
                          <span className={styles.who}>{entry.artist}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}

              {evidence?.kind === "mostPlayed" && (
                <div className={styles.proof}>
                  <div className={styles.solo}>
                    <Cover cover={evidence.cover} playing={index === active && playing} />
                    <ol className={styles.rows}>
                      {evidence.rows
                        .slice(0, isExpanded ? evidence.rows.length : Math.max(5, evidence.focusIndex + 1))
                        .map((row, rowIndex) => {
                          const focus = rowIndex === evidence.focusIndex;
                          const max = evidence.rows[0]?.plays || 1;
                          const runnerUp = evidence.rows.find((_, other) => other !== evidence.focusIndex);
                          const lead = runnerUp ? evidence.rows[evidence.focusIndex].plays - runnerUp.plays : 0;
                          // empate não vira "+0": a anotação diz o que o dado diz
                          const note =
                            evidence.focusIndex !== 0 || !runnerUp
                              ? "é esse aqui"
                              : lead > 0
                                ? `+${lead} que ${shorten(runnerUp.label)}`
                                : `empatado com ${shorten(runnerUp.label)}`;
                          return (
                            <li
                              key={`${row.sub}-${row.label}`}
                              className={styles.row}
                              data-focus={focus}
                              data-lit={focus && done.has(`${index}:regua`)}
                            >
                              <span className={styles.rowRank}>{rowIndex + 1}</span>
                              <span className={styles.rowText}>
                                <span className={styles.rowLabel}>{row.label}</span>
                                <span className={styles.rowSub}>{row.sub}</span>
                              </span>
                              <span className={styles.rowPlays}>{row.plays}</span>
                              <span className={styles.rowBar}>
                                <span
                                  ref={focus ? register(index, "bar") : undefined}
                                  style={{ width: `${(row.plays / max) * 100}%` }}
                                />
                              </span>
                              {focus && <span className={styles.rowNote}>{note}</span>}
                            </li>
                          );
                        })}
                    </ol>
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <Trace
        plan={plan}
        size={size}
        penWidth={Math.max(1.5, Math.min(2.5, size.width / 600))}
        reduced={reduced}
        readSignal={() => signal.current}
        onGesture={onGesture}
        travelStyle="straight"
      />

      {notes
        .filter((note) => done.has(note.gesture))
        .map((note) => (
          <p
            // a chave é o lugar (e o corte seco, para o "PAM." gritar de novo)
            key={`${note.id}:${Math.round(note.x)}:${Math.round(note.y)}:${note.kind === "grito" && !note.dim ? cut : 0}`}
            className={styles.note}
            data-kind={note.kind}
            data-align={note.align}
            data-dim={note.dim}
            style={{ left: note.x, top: note.y }}
          >
            {note.text}
          </p>
        ))}

      <nav className={styles.reactions} aria-label="Responder">
        {atEnd ? (
          <button type="button" className={styles.reaction} onClick={() => go(0)}>
            de novo <span className={styles.key}>↵</span>
          </button>
        ) : (
          <>
            <button
              type="button"
              className={styles.reaction}
              onClick={toggleSound}
              disabled={steps.length === 0 || activeDismissed}
            >
              {playing ? "para aí" : "toca aí"} <span className={styles.key}>T</span>
            </button>
            <button type="button" className={styles.reaction} onClick={() => go(active + 1)}>
              e o que mais? <span className={styles.key}>→</span>
            </button>
            <button type="button" className={styles.reaction} onClick={toggleMore} disabled={activeDismissed}>
              {expanded.includes(active) ? "menos" : "me mostra mais"} <span className={styles.key}>M</span>
            </button>
            <button type="button" className={styles.reaction} onClick={dismiss} disabled={activeDismissed}>
              nada a ver <span className={styles.key}>N</span>
            </button>
          </>
        )}
      </nav>
    </main>
  );
}
