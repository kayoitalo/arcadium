"use client";

import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { circle, highlight, jump, scribble, type Box, type Point } from "./gestures";
import type { StudyCover, StudyMoment } from "./moments";
import { Trace, type TraceGesture, type TracePlan, type WaveSpec } from "./trace";
import { useStudyAudio, type AudioStep } from "./use-study-audio";
import styles from "./estudo.module.css";

/*
 * O estudo: o amigo fala primeiro, você reage. Não há seletor de período
 * nem aba — cada momento vem de uma janela diferente, escolhida por ele.
 * "me mostra" põe a prova na mesa e o traço aponta para ela; "toca aí"
 * transforma o traço em corda; "e o que mais?" passa ao próximo assunto;
 * "nada a ver" risca o que ele disse. Nada disso persiste: é estudo.
 */

type Phase = "fala" | "prova";

interface Note {
  id: string;
  text: string;
  x: number;
  y: number;
  size: "lg" | "md";
  align?: "above";
}

const END = {
  window: "",
  headline: "Por hoje é isso.",
  narrative: "Volta semana que vem. Até lá eu já reparei em outra coisa.",
};

/** Quanto esperar a cena assentar antes de medir onde o traço vai. */
const SETTLE_MS = { first: 760, moment: 860, phase: 660, sound: 40 };

// Na saída, o framer resolve a variante com o `custom` do AnimatePresence, não
// com o de cada palavra: sem o padrão, o atraso vira NaN e a manchete antiga
// nunca termina de sair — e o modo "wait" segura a nova para sempre.
const slotVariants: Variants = {
  in: { y: "112%" },
  rest: (order: number = 0) => ({
    y: "0%",
    transition: { type: "spring", stiffness: 480, damping: 30, mass: 0.9, delay: 0.06 + order * 0.045 },
  }),
  out: (order: number = 0) => ({
    y: "-112%",
    transition: { duration: 0.2, ease: [0.55, 0, 0.8, 0.2], delay: order * 0.016 },
  }),
};

function boxOf(element: Element, origin: DOMRect): Box {
  const rect = element.getBoundingClientRect();
  return { left: rect.left - origin.left, top: rect.top - origin.top, width: rect.width, height: rect.height };
}

function linesOf(element: Element, origin: DOMRect): Box[] {
  return Array.from(element.getClientRects())
    .filter((rect) => rect.width > 2)
    .map((rect) => ({ left: rect.left - origin.left, top: rect.top - origin.top, width: rect.width, height: rect.height }));
}

/**
 * A moldura em volta de uma capa. A capa está inclinada, então a caixa que
 * a tela devolve é maior que ela: a moldura usa o tamanho de verdade da capa
 * e a mesma inclinação, com expoente alto para abraçar os cantos.
 */
function coverFrame(element: HTMLElement, origin: DOMRect, seed: string, pad: number): { points: Point[]; center: Point } {
  const rect = element.getBoundingClientRect();
  const center = { x: rect.left - origin.left + rect.width / 2, y: rect.top - origin.top + rect.height / 2 };
  const width = element.offsetWidth;
  const height = element.offsetHeight;
  const degrees = Number.parseFloat(getComputedStyle(element).rotate) || 0;
  const box = { left: center.x - width / 2, top: center.y - height / 2, width, height };
  return { points: circle(box, seed, pad, { exponent: 5, rotation: (degrees * Math.PI) / 180 }), center };
}

/** Até onde a manchete vai de fato: a caixa do título é mais larga que a frase. */
function textExtent(element: Element, origin: DOMRect): Box {
  const slots = Array.from(element.querySelectorAll("[data-slot]"));
  const boxes = slots.map((slot) => boxOf(slot, origin));
  if (boxes.length === 0) return boxOf(element, origin);
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.left + box.width));
  const bottom = Math.max(...boxes.map((box) => box.top + box.height));
  return { left, top, width: right - left, height: bottom - top };
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

/** Nome curto para caber numa anotação de caneta: sem "(The Remaster)", sem "(feat. …)". */
function shorten(text: string, max = 16): string {
  const bare = text.replace(/\s*[([].*?[)\]]/g, "").trim() || text;
  return bare.length > max ? `${bare.slice(0, max - 1).trimEnd()}…` : bare;
}

/**
 * Passagem entre fala e prova: cada peça marcada com data-flip sai de onde
 * estava e chega aonde o novo arranjo manda — em escala, nunca num corte.
 *
 * Mede a cada render, e não só quando o gatilho muda: a manchete de um
 * assunto novo entra depois da saída da anterior, num render à parte, e
 * sem essa medida ela não teria "de onde" sair na próxima passagem.
 */
function useFlip(stage: RefObject<HTMLElement | null>, trigger: string, reduced: boolean) {
  const rects = useRef(new Map<string, DOMRect>());
  const lastTrigger = useRef(trigger);
  useLayoutEffect(() => {
    const root = stage.current;
    if (!root) return;
    const changed = lastTrigger.current !== trigger;
    lastTrigger.current = trigger;
    const seen = new Set<string>();
    root.querySelectorAll<HTMLElement>("[data-flip]").forEach((element) => {
      const key = element.dataset.flip!;
      seen.add(key);
      const running = element.getAnimations().filter((animation) => animation.id === "flip");
      if (!changed) {
        // no meio de uma passagem a caixa está deslocada: vale a medida anterior
        if (running.length === 0) rects.current.set(key, element.getBoundingClientRect());
        return;
      }
      running.forEach((animation) => animation.cancel());
      const last = element.getBoundingClientRect();
      const first = rects.current.get(key);
      rects.current.set(key, last);
      if (!first || reduced || last.width === 0) return;
      const dx = first.left - last.left;
      const dy = first.top - last.top;
      const scale = first.width / last.width;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(scale - 1) < 0.01) return;
      const flip = element.animate(
        [
          { transformOrigin: "0 0", transform: `translate(${dx}px, ${dy}px) scale(${scale})` },
          { transformOrigin: "0 0", transform: "none" },
        ],
        { duration: 620, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
      flip.id = "flip";
    });
    for (const key of [...rects.current.keys()]) if (!seen.has(key)) rects.current.delete(key);
  });
}

function Words({
  text,
  markRef,
  marked,
  reduced,
  onLanded,
}: {
  text: string;
  markRef: RefObject<HTMLSpanElement | null>;
  marked: boolean;
  reduced: boolean;
  /** A última palavra pousou: só agora o grifo sabe onde a frase ficou. */
  onLanded: () => void;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  // o grifo pega o fim da frase; palavra de uma ou duas letras não vale grifo sozinha
  const marks = words.length >= 3 && words[words.length - 2].replace(/[^\p{L}\p{N}]/gu, "").length > 2 ? 2 : 1;
  const plain = words.slice(0, words.length - marks);
  const tail = words.slice(words.length - marks);

  const slot = (word: string, order: number) => (
    <span className={styles.slot} data-slot key={order}>
      <motion.span
        className={styles.slotIn}
        custom={order}
        variants={slotVariants}
        initial={reduced ? false : "in"}
        animate="rest"
        exit={reduced ? undefined : "out"}
        onAnimationComplete={(definition) => {
          if (definition === "rest" && order === words.length - 1) onLanded();
        }}
      >
        {word}
      </motion.span>
    </span>
  );

  return (
    <>
      {plain.map((word, index) => (
        <Fragment key={index}>
          {slot(word, index)}{" "}
        </Fragment>
      ))}
      <span ref={markRef} className={styles.mark} data-marked={marked}>
        {tail.map((word, index) => (
          <Fragment key={index}>
            {index > 0 && " "}
            {slot(word, plain.length + index)}
          </Fragment>
        ))}
      </span>
    </>
  );
}

function Cover({
  cover,
  flip,
  tilt,
  delay = 0,
  playing = false,
  slam = false,
  innerRef,
}: {
  cover: StudyCover;
  flip: string;
  tilt: number;
  delay?: number;
  playing?: boolean;
  slam?: boolean;
  innerRef?: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={innerRef}
      className={styles.cover}
      data-flip={flip}
      data-playing={playing}
      data-slam={slam}
      style={{ ["--tilt" as string]: `${tilt}deg`, ["--delay" as string]: `${delay}ms` }}
    >
      {cover.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover.url} alt={`${cover.title}, de ${cover.artist}`} draggable={false} />
      ) : (
        <span className={styles.coverEmpty}>{cover.title}</span>
      )}
    </div>
  );
}

export function Estudo({ moments }: { moments: StudyMoment[] }) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("fala");
  const [dismissing, setDismissing] = useState(false);
  const [plan, setPlan] = useState<TracePlan | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [shown, setShown] = useState<Set<string>>(() => new Set());
  const [marked, setMarked] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [cut, setCut] = useState<{ at: number; x: number; y: number } | null>(null);

  const reduced = Boolean(useReducedMotion());
  const audio = useStudyAudio();
  const stageRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);
  const soloRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLLIElement>(null);
  const signal = useRef<ArrayLike<number> | null>(null);
  const lastPose = useRef<{ index: number; phase: Phase } | null>(null);
  const planRef = useRef<TracePlan | null>(null);
  const notesRef = useRef<Note[]>([]);
  const dismissTimer = useRef<number | null>(null);
  const { play, stop, read, playing, step } = audio;

  const end = index >= moments.length;
  const moment = end ? null : moments[index];
  const evidence = moment?.evidence ?? null;
  const steps = useMemo<AudioStep[]>(() => {
    if (!evidence) return [];
    if (evidence.kind === "transition") {
      return [
        ...(evidence.from.previewUrl ? [{ url: evidence.from.previewUrl, seconds: 6.5 }] : []),
        ...(evidence.to.previewUrl ? [{ url: evidence.to.previewUrl }] : []),
      ];
    }
    return evidence.previewUrl ? [{ url: evidence.previewUrl }] : [];
  }, [evidence]);
  // na transição, a primeira faixa toca na capa de origem e o corte leva à outra
  const playingSide: "from" | "to" | null = playing ? (step === 0 && steps.length > 1 ? "from" : "to") : null;

  // na fala de uma transição a corda troca de capa no corte seco: o passo entra na pose
  const sound = !playing ? "" : evidence?.kind === "transition" && phase === "fala" ? `som${step}` : "som";
  const pose = `${index}:${phase}:${dismissing ? "risco" : ""}:${sound}`;

  useFlip(stageRef, `${index}:${phase}`, reduced);

  // ---------- onde o traço vai ----------

  const measure = useCallback(
    (instant: boolean) => {
      const stage = stageRef.current;
      if (!stage) return;
      const origin = stage.getBoundingClientRect();
      const pen = Math.max(4, Math.min(7.5, origin.width / 200));
      const gestures: TraceGesture[] = [];
      const nextNotes: Note[] = [];
      let wave: WaveSpec | null = null;

      // a semente é do assunto, não da pose: o arco que vira corda é o mesmo arco
      const seed = (gesture: string) => `${index}:${gesture}`;
      const small = origin.width < 760;

      if (dismissing && headlineRef.current) {
        gestures.push({
          id: "risco",
          layer: "over",
          strokes: [scribble(textExtent(headlineRef.current, origin), seed("risco"))],
          width: pen * 1.2,
        });
      } else if ((phase === "fala" || end) && markRef.current) {
        const lines = linesOf(markRef.current, origin);
        if (lines.length > 0) {
          gestures.push({ id: "grifo", layer: "under", strokes: highlight(lines, seed("grifo")), width: lines[0].height * 0.64 });
        }
      } else if (evidence?.kind === "transition" && fromRef.current && toRef.current) {
        const from = boxOf(fromRef.current, origin);
        const { points, arc, apex } = jump(from, boxOf(toRef.current, origin), seed("salto"));
        // com som, o próprio arco é a corda: vibra ali mesmo, entre as duas faixas,
        // e só para baixo — para cima ela atropelaria o "PAM." no alto do salto
        if (playing) {
          wave = {
            base: arc,
            amp: Math.min(52, from.height * 0.28),
            inPlace: true,
            outwardFrom: { x: apex.x, y: apex.y - 1000 },
          };
        }
        else gestures.push({ id: "salto", layer: "over", strokes: [points], width: pen });
        nextNotes.push({ id: "salto", text: "PAM.", x: apex.x, y: apex.y - 12, size: "lg" });
      } else if (evidence?.kind === "mostPlayed" && focusRef.current) {
        const row = boxOf(focusRef.current, origin);
        gestures.push({ id: "roda", layer: "over", strokes: [circle(row, seed("roda"), 16)], width: pen });
        const { rows, focusIndex } = evidence;
        const runnerUp = rows.find((_, rowIndex) => rowIndex !== focusIndex);
        const text =
          focusIndex === 0 && runnerUp
            ? `+${rows[0].plays - runnerUp.plays} que ${shorten(runnerUp.label)}`
            : "esse aqui";
        // ao lado do círculo quando cabe; senão por cima dele, puxado para a direita
        const right = row.left + row.width + 44;
        const fits = right + 260 < origin.width;
        nextNotes.push(
          fits
            ? { id: "roda", text, x: right, y: row.top + row.height / 2, size: "md" }
            : { id: "roda", text, x: row.left + row.width + 8, y: row.top - 14, size: "md", align: "above" },
        );
      }

      // com som, e fora do arco da transição, a corda abraça a capa que está
      // tocando: em volta de uma imagem não há texto para ela atropelar
      if (playing && !dismissing && !wave) {
        const cover =
          evidence?.kind === "transition" ? (playingSide === "from" ? fromRef.current : toRef.current) : soloRef.current;
        if (cover) {
          const frame = coverFrame(cover, origin, seed(`corda:${playingSide ?? "solo"}`), small ? 10 : 18);
          wave = { base: frame.points, amp: small ? 8 : 13, outwardFrom: frame.center };
        }
      }

      const candidate: TracePlan = { key: pose, gestures, wave, instant };
      const previous = planRef.current;
      // remedida da mesma pose (fonte que chegou, tela que mudou) só vale se
      // algo andou de lugar: senão ela atropelaria o traço no meio do gesto
      if (instant && previous?.key === pose && sameGeometry(previous, candidate)) return;
      if (!instant) {
        // o que continua na tela continua escrito: o grifo não pisca e a
        // anotação não repete o grito só porque a música começou
        const stays = (id: string) => {
          const before = previous?.gestures.find((gesture) => gesture.id === id);
          const after = gestures.find((gesture) => gesture.id === id);
          return Boolean(before && after && JSON.stringify(before.strokes) === JSON.stringify(after.strokes));
        };
        const noteStays = (note: Note) =>
          notesRef.current.some((old) => old.id === note.id && Math.abs(old.x - note.x) < 2 && Math.abs(old.y - note.y) < 2);
        if (!stays("grifo")) setMarked(false);
        const keep = new Set(nextNotes.filter(noteStays).map((note) => note.id));
        setShown((current) => new Set([...current].filter((id) => keep.has(id))));
      }
      notesRef.current = nextNotes;
      setNotes(nextNotes);
      planRef.current = candidate;
      setPlan(candidate);
    },
    [dismissing, end, evidence, index, phase, playing, playingSide, pose],
  );
  const measureRef = useRef(measure);
  measureRef.current = measure;

  // quando a manchete nova termina de pousar, o traço confere onde ela ficou.
  // Se nada andou, o gesto que já está na tela continua (o motor não redesenha
  // traço idêntico); se a medida anterior pegou a frase velha, ele corrige.
  const landed = useCallback(() => {
    if (planRef.current) measureRef.current(false);
  }, []);

  // a cena muda, espera assentar, mede e manda o traço
  useEffect(() => {
    const previous = lastPose.current;
    lastPose.current = { index, phase };
    const settle = !previous
      ? SETTLE_MS.first
      : dismissing
        ? 0
        : previous.index !== index
          ? SETTLE_MS.moment
          : previous.phase !== phase
            ? SETTLE_MS.phase
            : SETTLE_MS.sound;
    const timer = window.setTimeout(() => measureRef.current(false), reduced ? 0 : settle);
    return () => window.clearTimeout(timer);
    // só a pose decide quando medir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pose]);

  // tela mudou de tamanho, ou a fonte chegou: mesma pose, medida nova, sem animar
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
    if (id === "grifo" && moment === "start") setMarked(true);
    if (moment === "end") setShown((current) => new Set(current).add(id));
  }, []);

  // ---------- som ----------

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

  // o corte seco da transição ganha a reação dele, em cima da capa que entrou
  useEffect(() => {
    if (!playing || step === 0 || !toRef.current || !stageRef.current) return;
    const box = boxOf(toRef.current, stageRef.current.getBoundingClientRect());
    setCut({ at: Date.now(), x: box.left + box.width / 2, y: box.top - 18 });
    const timer = window.setTimeout(() => setCut(null), 1100);
    return () => window.clearTimeout(timer);
  }, [playing, step]);

  // ---------- respostas ----------

  const next = useCallback(() => {
    if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
    stop();
    setDismissing(false);
    setPhase("fala");
    setIndex((current) => Math.min(current + 1, moments.length));
  }, [moments.length, stop]);

  const again = useCallback(() => {
    stop();
    setPhase("fala");
    setIndex(0);
  }, [stop]);

  const toggleProof = useCallback(() => {
    if (end || dismissing) return;
    setPhase((current) => (current === "fala" ? "prova" : "fala"));
  }, [dismissing, end]);

  const toggleSound = useCallback(() => {
    if (end || dismissing || steps.length === 0) return;
    if (playing) stop();
    else play(steps);
  }, [dismissing, end, play, playing, steps, stop]);

  const dismiss = useCallback(() => {
    if (end || dismissing) return;
    stop();
    setDismissing(true);
    dismissTimer.current = window.setTimeout(next, 1700);
  }, [dismissing, end, next, stop]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === "m") toggleProof();
      else if (key === "t" || key === " ") {
        event.preventDefault();
        toggleSound();
      } else if (key === "arrowright" || key === "enter") {
        event.preventDefault();
        if (end) again();
        else next();
      } else if (key === "n") dismiss();
      else return;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [again, dismiss, end, next, toggleProof, toggleSound]);

  useEffect(() => () => {
    if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
  }, []);

  if (moments.length === 0) {
    return (
      <main className={styles.stage} data-phase="fala">
        <header className={styles.bar}>
          <span className={styles.wordmark}>arcadium</span>
        </header>
        <section className={styles.empty}>
          <h1 className={styles.headline}>Ainda não tenho nada pra te contar.</h1>
          <p className={styles.narrative}>Quando os textos deste período saírem, eu volto aqui.</p>
        </section>
      </main>
    );
  }

  const talk = moment ?? END;

  return (
    <main ref={stageRef} className={styles.stage} data-phase={end ? "fala" : phase} data-end={end}>
      <header className={styles.bar}>
        <div>
          <span className={styles.wordmark}>arcadium</span>
          <span className={styles.study}>estudo de linguagem</span>
        </div>
        <div className={styles.dots} role="img" aria-label={`Assunto ${Math.min(index + 1, moments.length)} de ${moments.length}`}>
          {moments.map((entry, dot) => (
            <span
              key={entry.key}
              className={styles.dot}
              data-state={dot < index ? "done" : dot === index ? "now" : "next"}
            />
          ))}
        </div>
      </header>

      <section className={styles.scene}>
        <div className={styles.talk} aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={`w${index}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {talk.window && (
                <p className={styles.window} data-flip={`w${index}`}>
                  {talk.window}
                </p>
              )}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.h1 key={`h${index}`} ref={headlineRef} className={styles.headline} data-flip={`h${index}`}>
              <Words text={talk.headline} markRef={markRef} marked={marked} reduced={reduced} onLanded={landed} />
            </motion.h1>
          </AnimatePresence>

          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={`n${index}:${dismissing}`}
              className={dismissing ? styles.reply : styles.narrative}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { delay: dismissing ? 0.2 : 0.42, duration: 0.3 } }}
              exit={{ opacity: 0, transition: { duration: 0.14 } }}
            >
              {dismissing ? "Justo. Finge que eu não falei nada." : talk.narrative}
            </motion.p>
          </AnimatePresence>
        </div>

        {evidence && (
          <div className={styles.evidence} key={`e${index}`}>
            {evidence.kind === "transition" ? (
              <div className={styles.pair}>
                {(["from", "to"] as const).map((side, order) => {
                  const entry = evidence[side];
                  return (
                    <figure className={styles.side} data-side={side} key={side}>
                      <Cover
                        cover={entry.cover}
                        flip={`c${index}${side}`}
                        tilt={side === "from" ? -7 : 5}
                        delay={180 + order * 140}
                        playing={playingSide === side}
                        slam={side === "to" && cut !== null}
                        innerRef={side === "from" ? fromRef : toRef}
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
                {/* o comentário dele mora embaixo do salto, entre as duas faixas */}
                <div className={styles.pairNote}>
                  <p className={styles.insight}>{moment?.insight}</p>
                  {moment?.closing && <p className={styles.closing}>{moment.closing}</p>}
                </div>
              </div>
            ) : (
              <div className={styles.solo}>
                <Cover
                  cover={evidence.cover}
                  flip={`c${index}solo`}
                  tilt={4}
                  delay={200}
                  playing={playing}
                  innerRef={soloRef}
                />
                <ol className={styles.rows}>
                  {evidence.rows.map((row, rowIndex) => {
                    const max = evidence.rows[0]?.plays || 1;
                    const focus = rowIndex === evidence.focusIndex;
                    return (
                      <li
                        key={`${row.sub}-${row.label}`}
                        ref={focus ? focusRef : undefined}
                        className={styles.row}
                        data-focus={focus}
                      >
                        <span className={styles.rowRank}>{rowIndex + 1}</span>
                        <span className={styles.rowText}>
                          <span className={styles.rowLabel}>{row.label}</span>
                          <span className={styles.rowSub}>{row.sub}</span>
                        </span>
                        <span className={styles.rowPlays}>{row.plays}</span>
                        <span className={styles.rowBar} style={{ ["--share" as string]: row.plays / max }}>
                          <span />
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </div>
        )}

        {moment && evidence?.kind !== "transition" && (
          <div className={styles.insightBlock} key={`i${index}`}>
            <p className={styles.insight}>{moment.insight}</p>
            {moment.closing && <p className={styles.closing}>{moment.closing}</p>}
          </div>
        )}
      </section>

      <Trace
        plan={plan}
        size={size}
        penWidth={Math.max(4, Math.min(7.5, size.width / 200))}
        reduced={reduced}
        readSignal={() => signal.current}
        onGesture={onGesture}
      />

      {notes
        .filter((note) => shown.has(note.id))
        .map((note) => (
          <p
            // a chave é o lugar, não a pose: a anotação que não se mexeu não grita de novo
            key={`${index}:${note.id}:${Math.round(note.x)}:${Math.round(note.y)}`}
            className={styles.note}
            data-size={note.size}
            data-align={note.align}
            style={{ left: note.x, top: note.y }}
          >
            {note.text}
          </p>
        ))}

      {cut && evidence?.kind === "transition" && (
        <p key={cut.at} className={styles.note} data-size="lg" style={{ left: cut.x, top: cut.y }}>
          PAM.
        </p>
      )}

      <nav className={styles.reactions} aria-label="Responder">
        {end ? (
          <button type="button" className={styles.reaction} onClick={again}>
            de novo <span className={styles.key}>↵</span>
          </button>
        ) : (
          <>
            <button type="button" className={styles.reaction} onClick={toggleProof} disabled={dismissing}>
              {phase === "prova" ? "volta" : "me mostra"} <span className={styles.key}>M</span>
            </button>
            <button type="button" className={styles.reaction} onClick={toggleSound} disabled={dismissing || steps.length === 0}>
              {playing ? "para aí" : "toca aí"} <span className={styles.key}>T</span>
            </button>
            <button type="button" className={styles.reaction} onClick={next}>
              e o que mais? <span className={styles.key}>→</span>
            </button>
            <button type="button" className={styles.reaction} onClick={dismiss} disabled={dismissing}>
              nada a ver <span className={styles.key}>N</span>
            </button>
          </>
        )}
      </nav>
    </main>
  );
}
