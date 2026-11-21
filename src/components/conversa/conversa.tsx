"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Fala, PenLayer, Resposta, Respostas, type Claim } from "@/components/amigo/fala";
import { asterisk, band, bracket, check, dimension, strike, type Point } from "@/components/amigo/gestures";
import { boxOf, textLines } from "@/components/amigo/measure";
import type { TraceGesture, WaveSpec } from "@/components/amigo/trace";
import { usePen, type PenDrawing, type PenNote } from "@/components/amigo/use-pen";
import { usePulse } from "@/components/amigo/use-pulse";
import { useSound, type SoundStep } from "@/components/amigo/use-sound";
import { useTabTitle } from "@/components/amigo/use-tab-title";
import type { ConversationMoment, Evidence } from "@/modules/conversation/domain/conversation.types";
import { decadeLabel, ProvaDecadas, ProvaLista, ProvaTransicao } from "./provas";
import { ProvaEstreia, ProvaLoop, ProvaMadrugada, ProvaMaratona, ProvaSurpresa, ProvaVolta } from "./provas-raras";
import styles from "./conversa.module.css";
import { privateFetch } from "@/lib/http/private-fetch";
import { cardFromMoment, deliverCard, renderCard } from "./cartao";
import { cleanTitle } from "@/lib/music/track-title";
import { coverProxyUrl } from "@/lib/cover";

/*
 * A conversa: a tela inicial. Um fio que se rola e se revisita — o
 * assunto da vez é o que cruza o meio da tela, o que ele já disse fica
 * mais apagado, e o que você mandou esquecer fica riscado (e ele não
 * volta a falar daquilo: a conta lembra).
 *
 * Cada frase chega com a prova que cita, sempre na tela e em repouso. O
 * traço dele grifa o fim da manchete, mede o salto entre duas capas e
 * passa a régua na barra citada; com música tocando, esse traço vira a
 * corda que vibra com o som de verdade.
 */

const FIM = {
  headline: "Por hoje é isso.",
  narrative: "Volta daqui a uns dias. Até lá eu já reparei em outra coisa.",
};

const REPLY = "Justo. Finge que eu não falei nada.";

function stepsOf(evidence: Evidence | null | undefined): SoundStep[] {
  if (!evidence) return [];
  if (evidence.kind === "transition") {
    return [
      // a primeira toca um pouco e corta seco para a segunda: o "de repente"
      ...(evidence.from.previewUrl ? [{ url: evidence.from.previewUrl, seconds: 6.5 }] : []),
      ...(evidence.to.previewUrl ? [{ url: evidence.to.previewUrl }] : []),
    ];
  }
  if (evidence.kind === "decades") return [];
  return evidence.previewUrl ? [{ url: evidence.previewUrl }] : [];
}

/** O que a prova sustenta, como a frase nomearia: se a manchete citar, o grifo vai ali. */
function marksOf(evidence: Evidence | null | undefined): string[] | undefined {
  if (!evidence) return undefined;
  if (evidence.kind === "transition") {
    // o "de repente" é a chegada: a segunda vem antes
    return [evidence.to.track, evidence.from.track, evidence.to.artist, evidence.from.artist];
  }
  if (evidence.kind === "ranking") {
    const row = evidence.rows[evidence.focusIndex];
    return [row.label, row.sub].filter(Boolean);
  }
  if (evidence.kind === "loop") return [evidence.track, evidence.artist];
  if (evidence.kind === "night") return evidence.steps.flatMap((step) => [step.track, step.artist]);
  if (evidence.kind !== "decades") return [evidence.artist];
  return evidence.focus.flatMap((decade) => [decadeLabel(decade), `${decade}s`]);
}

/** Os trechos da fala que apontam pra uma peça da prova: o nome na frase e a peça na tela. */
function claimsOf(evidence: Evidence | null | undefined): Array<Claim & { target: string }> {
  if (!evidence) return [];
  if (evidence.kind === "transition") {
    return [
      { id: "to:track", text: evidence.to.track, target: "to" },
      { id: "to:artist", text: evidence.to.artist, target: "to" },
      { id: "from:track", text: evidence.from.track, target: "from" },
      { id: "from:artist", text: evidence.from.artist, target: "from" },
    ];
  }
  if (evidence.kind === "ranking") {
    const row = evidence.rows[evidence.focusIndex];
    return [
      { id: "row:label", text: cleanTitle(row.label), target: "bar" },
      ...(row.sub ? [{ id: "row:sub", text: row.sub, target: "bar" }] : []),
    ];
  }
  if (evidence.kind === "decades") {
    return evidence.focus.flatMap((decade) => [
      { id: `decada:${decade}`, text: decadeLabel(decade), target: `bar:${decade}` },
      { id: `decada-s:${decade}`, text: `${decade}s`, target: `bar:${decade}` },
    ]);
  }
  return [];
}

/** A capa que representa o assunto no índice: a de chegada numa transição; décadas não têm capa. */
function coverOf(evidence: Evidence | null | undefined): string | null {
  if (!evidence) return null;
  if (evidence.kind === "transition") return evidence.to.cover.url ?? evidence.from.cover.url;
  if (evidence.kind === "decades") return null;
  return "cover" in evidence ? evidence.cover.url : null;
}

/** A régua dele em cima de uma barra do dado: a própria barra, na cor dele. */
function ruler(bar: HTMLElement, origin: DOMRect): { base: Point[]; box: ReturnType<typeof boxOf> } {
  const box = boxOf(bar, origin);
  const y = box.top + box.height / 2;
  return {
    base: [
      { x: box.left, y },
      { x: box.left + box.width, y },
    ],
    box,
  };
}

/**
 * `epilogue` fecha o fio: o convite para continuar só aparece depois que ele terminou de falar.
 * `endReplies` são as respostas que esse convite oferece no pé; sem elas, fica o caminho genérico.
 */
export function Conversa({
  moments: all,
  epilogue,
  endReplies,
  masthead,
  ending = FIM,
}: {
  moments: ConversationMoment[];
  /** Antes do fio: o dia de hoje, com o que tocou. A caneta sublinha a data. */
  masthead?: ReactNode;
  epilogue?: ReactNode;
  endReplies?: ReactNode;
  /** A fala que fecha o fio; a do retrato fala de mês, não de dias. */
  ending?: { headline: string; narrative: string };
}) {
  const reduced = Boolean(useReducedMotion());
  const moments = all;
  const [editorialError, setEditorialError] = useState<string | null>(null);
  const editorialBusy = useRef(false);
  // o fim também é um bloco do fio
  const total = moments.length + 1;

  const [active, setActive] = useState(0);
  const [seen, setSeen] = useState<number[]>([0]);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [cut, setCut] = useState(0);
  /** O trecho da fala que você apontou: a caneta liga ele à peça da prova. */
  const [pointing, setPointing] = useState<{ index: number; id: string } | null>(null);
  /** O cartão do assunto da vez: montando, entregue ou com erro. */
  const [card, setCard] = useState<"idle" | "busy" | "saved" | "failed">("idle");

  const stageRef = useRef<HTMLDivElement>(null);
  const parts = useRef(new Map<string, HTMLElement>());
  const dismissTimer = useRef(0);
  useEffect(() => {
    const key = moments[active]?.editorialKey;
    const element = parts.current.get(`${active}:headline`);
    if (!key || !element || !("IntersectionObserver" in window)) return;
    let visible = false; let sent = false; let pending = false; let alive = true;
    const expose = async () => {
      if (!alive || sent || pending || !visible || document.visibilityState !== "visible") return;
      pending = true;
      try { const response = await privateFetch("/api/editorial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, version: moments[active]?.editorialVersion ?? 0, action: "SEEN" }) }); sent = response.ok; }
      catch { /* A failed read receipt does not dismiss a topic. */ } finally { pending = false; }
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting && entry.intersectionRatio >= .5; void expose(); }, { threshold: .5 });
    observer.observe(element); document.addEventListener("visibilitychange", expose);
    return () => { alive = false; observer.disconnect(); document.removeEventListener("visibilitychange", expose); };
  }, [active, moments]);

  const register = useCallback(
    (index: number) => (part: string) => (node: HTMLElement | null) => {
      const key = `${index}:${part}`;
      if (node) parts.current.set(key, node);
      else parts.current.delete(key);
    },
    [],
  );

  const sound = useSound();
  const { stop, play } = sound;
  const signal = usePulse(stageRef, sound.playing, sound.read);
  const steps = useMemo(() => stepsOf(moments[active]?.evidence), [active, moments]);
  const playingSide: "from" | "to" | null = sound.playing
    ? sound.step === 0 && steps.length > 1
      ? "from"
      : "to"
    : null;

  /** O que a prévia do assunto da vez está tocando, para o título da aba. */
  const soundingLabel = useMemo(() => {
    const evidence = moments[active]?.evidence;
    if (!sound.playing || !evidence) return null;
    if (evidence.kind === "transition") {
      const side = playingSide === "from" ? evidence.from : evidence.to;
      return `${side.track} · ${side.artist}`;
    }
    return evidence.kind === "ranking" ? evidence.previewTrack : null;
  }, [active, moments, playingSide, sound.playing]);
  useTabTitle(soundingLabel);

  // ---------- onde o traço vai ----------

  const pose = `${seen.join(",")}|${active}|${dismissed.join(",")}|${expanded.join(",")}|${sound.playing ? "som" : ""}|${pointing ? `${pointing.index}:${pointing.id}` : ""}|${masthead ? "dia" : ""}`;

  const draw = (origin: DOMRect): PenDrawing => {
    const thin = Math.max(1.5, Math.min(2.5, origin.width / 600));
    const gestures: TraceGesture[] = [];
    const notes: PenNote[] = [];
    let wave: WaveSpec | null = null;

    // a data do cabeçalho: sublinhada uma vez, como quem abre a página do caderno
    const dia = stageRef.current?.querySelector<HTMLElement>("[data-dia]");
    if (dia) {
      const { lines, size } = textLines(dia, origin);
      const line = lines[lines.length - 1];
      if (line) {
        const y = line.baseline + size * 0.16;
        gestures.push({ id: "dia", layer: "over", strokes: [[{ x: line.left - 2, y }, { x: line.left + (line.right - line.left) * 0.55, y: y - 0.8 }, { x: line.right + 4, y: y - 2.4 }]], width: thin, dim: active !== 0 });
      }
    }

    // o fio de hoje, conferido: visto no que você viu, risco no que dispensou
    if (seen.includes(moments.length)) {
      moments.forEach((_, index) => {
        const item = parts.current.get(`${moments.length}:fio:${index}`);
        if (!item) return;
        if (dismissed.includes(index)) {
          const { lines, size } = textLines(item, origin);
          gestures.push({ id: `fio:${index}:risco`, layer: "over", strokes: strike(lines, size), width: Math.max(1.6, size * 0.08), cap: "butt", dim: active !== moments.length });
        } else if (seen.includes(index)) {
          gestures.push({ id: `fio:${index}:visto`, layer: "over", strokes: [check(boxOf(item, origin), 14)], width: Math.max(1.8, thin), dim: active !== moments.length });
        }
      });
    }

    for (const index of seen) {
      const dim = index !== active;
      const part = (name: string) => parts.current.get(`${index}:${name}`);

      if (dismissed.includes(index)) {
        const headline = part("headline");
        if (headline) {
          const { lines, size } = textLines(headline, origin);
          gestures.push({
            id: `${index}:risco`,
            layer: "over",
            strokes: strike(lines, size),
            width: Math.max(2, size * 0.055),
            cap: "butt",
            dim,
          });
        }
        continue;
      }

      const mark = part("mark");
      if (mark) {
        const { lines, size } = textLines(mark, origin);
        if (lines.length > 0) {
          const { strokes, width } = band(lines, size);
          gestures.push({ id: `${index}:grifo`, layer: "under", strokes, width, cap: "butt", dim });
        }
      }

      const evidence = moments[index]?.evidence;
      const live = sound.playing && index === active;

      if (evidence?.kind === "transition") {
        const from = part("from");
        const to = part("to");
        if (!from || !to) continue;
        const fromBox = boxOf(from, origin);
        const lift = Math.min(96, Math.max(52, fromBox.height * 0.42));
        const { posts, span, mid } = dimension(fromBox, boxOf(to, origin), lift);
        // com som, a travessa vira corda: as colunas ficam, ela vibra
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
        notes.push({ id: `${index}:pam`, gesture: `${index}:cota`, text: "PAM.", x: mid.x, y: mid.y - 12, kind: "grito", dim });
        // embaixo da travessa é onde a corda vibra: tocando, o intervalo sai da frente (as horas seguem nas legendas)
        if (!live) {
          notes.push({
            id: `${index}:intervalo`,
            gesture: `${index}:cota`,
            text: evidence.gapMinutes < 1 ? "logo em seguida" : `${evidence.gapMinutes} min depois`,
            x: posts[1][0].x - 12,
            y: mid.y + 10,
            kind: "dado",
            align: "end",
            dim,
          });
        }
      } else if (evidence?.kind === "ranking") {
        const bar = part("bar");
        if (!bar) continue;
        const { base, box } = ruler(bar, origin);
        if (live) {
          // numa lista a folga é curta: a corda desce pouco e nunca alcança a anotação
          wave = { base, amp: 7, inPlace: true, outwardFrom: { x: box.left, y: base[0].y - 1000 }, width: box.height + 1, cap: "butt" };
        } else {
          gestures.push({ id: `${index}:regua`, layer: "over", strokes: [base], width: box.height + 1, cap: "butt", dim });
        }
        // o colchete junta o pelotão da frente, do lado do número
        const first = part("podio:a");
        const third = part("podio:b");
        if (first && third) {
          const a = boxOf(first, origin);
          const c = boxOf(third, origin);
          gestures.push({
            id: `${index}:colchete`,
            layer: "over",
            strokes: [bracket({ left: a.left, top: a.top + 6, width: a.width, height: c.top + c.height - a.top - 12 }, "left", 12, 7)],
            width: thin,
            dim,
          });
        }
      } else if (evidence?.kind === "decades") {
        for (const decade of evidence.focus) {
          const bar = part(`bar:${decade}`);
          if (!bar) continue;
          const { base, box } = ruler(bar, origin);
          gestures.push({ id: `${index}:regua:${decade}`, layer: "over", strokes: [base], width: box.height + 1, cap: "butt", dim });
        }
        // o asterisco no número e o mesmo na nota de rodapé: a ressalva fica ligada ao dado que ela ressalva
        for (const name of ["aster:valor", "aster:pe"]) {
          const slot = part(name);
          if (!slot) continue;
          const at = boxOf(slot, origin);
          gestures.push({
            id: `${index}:${name}`,
            layer: "over",
            strokes: asterisk({ x: at.left + at.width / 2, y: at.top + at.height * 0.42 }, name === "aster:pe" ? 8 : 9),
            width: Math.max(1.3, thin * 0.8),
            dim,
          });
        }
      }
    }

    // a frase apontada: uma cota de desenho técnico do fim do trecho até a peça que ele cita
    if (pointing && pointing.index === active && !dismissed.includes(active)) {
      const claim = claimsOf(moments[active]?.evidence).find((entry) => entry.id === pointing.id);
      const from = parts.current.get(`${active}:claim:${pointing.id}`);
      const to = claim ? parts.current.get(`${active}:${claim.target}`) : undefined;
      if (from && to) {
        const rects = from.getClientRects();
        const last = rects[rects.length - 1] ?? from.getBoundingClientRect();
        const a = { x: last.right - origin.left + 6, y: last.top - origin.top + last.height * 0.55 };
        const box = boxOf(to, origin);
        const b = { x: box.left - 10, y: box.top + box.height / 2 };
        const stroke = b.x > a.x + 24
          ? [a, { x: (a.x + b.x) / 2, y: a.y }, { x: (a.x + b.x) / 2, y: b.y }, b]
          : [a, { x: a.x, y: Math.min(a.y, b.y) - 22 }, { x: box.left + box.width / 2, y: Math.min(a.y, b.y) - 22 }, { x: box.left + box.width / 2, y: box.top - 6 }];
        gestures.push({ id: `${active}:aponta:${pointing.id}`, layer: "over", strokes: [stroke], width: thin, join: "round" });
      }
    }

    return { gestures, wave, notes };
  };

  const pen = usePen(stageRef, draw, pose);
  const { forget } = pen;
  // o corte seco da transição: o "PAM." do assunto da vez grita de novo
  const notes = pen.notes.map((note) => (note.kind === "grito" && !note.dim ? { ...note, pop: cut } : note));

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

  // mudou de assunto, o trecho apontado no anterior deixa de ser apontado
  useEffect(() => { setPointing(null); }, [active]);

  // mudou de assunto, a música daquele assunto para
  useEffect(() => {
    stop();
  }, [active, stop]);

  useEffect(() => {
    if (sound.playing && sound.step > 0) setCut((current) => current + 1);
  }, [sound.playing, sound.step]);

  // ---------- respostas ----------

  const go = useCallback(
    (index: number) => {
      const target = parts.current.get(`${Math.max(0, Math.min(total - 1, index))}:block`);
      target?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
    },
    [reduced, total],
  );

  const activeDismissed = dismissed.includes(active);
  const atEnd = active >= moments.length;
  const activeEvidence = moments[active]?.evidence;
  const canExpand =
    !activeDismissed &&
    (activeEvidence?.kind === "transition" ||
      (activeEvidence?.kind === "ranking" && activeEvidence.rows.length > Math.max(5, activeEvidence.focusIndex + 1)));

  const toggleSound = useCallback(() => {
    if (steps.length === 0 || activeDismissed) return;
    if (sound.playing) stop();
    else play(steps);
  }, [activeDismissed, play, sound.playing, steps, stop]);

  const toggleMore = useCallback(() => {
    if (!canExpand) return;
    setExpanded((current) => (current.includes(active) ? current.filter((index) => index !== active) : [...current, active]));
  }, [active, canExpand]);

  /** "nada a ver" risca o assunto e o esquece; no assunto riscado, desfaz. */
  const dismiss = useCallback(async () => {
    const moment = moments[active];
    if (!moment || editorialBusy.current) return;
    if (moment.editorialKey) {
      editorialBusy.current = true; setEditorialError(null);
      try {
        const response = await privateFetch("/api/editorial", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: moment.editorialKey, action: activeDismissed ? "RESTORE" : "DISMISS" }) });
        if (!response.ok) throw new Error("Não consegui guardar essa escolha. O assunto continua disponível.");
      } catch (cause) { setEditorialError(cause instanceof Error ? cause.message : "Falha ao guardar escolha."); return; }
      finally { editorialBusy.current = false; }
    }
    window.clearTimeout(dismissTimer.current);
    if (activeDismissed) {
      setDismissed((current) => current.filter((index) => index !== active));
      return;
    }
    stop();
    setDismissed((current) => [...current, active]);
    setExpanded((current) => current.filter((index) => index !== active));
    forget(`${active}:`);
    dismissTimer.current = window.setTimeout(() => go(active + 1), 1400);
  }, [active, activeDismissed, forget, go, moments, stop]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      // tecla sem foco em nada chega com o documento (ou a janela) como alvo
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, button, a, summary, [contenteditable='true']")) return;
      const key = event.key.toLowerCase();
      // em botão ou link com foco, Enter e espaço são dele
      if ((key === "enter" || key === " ") && target?.closest("button, a")) return;
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

  // outro assunto, outro cartão
  useEffect(() => { setCard("idle"); }, [active]);

  /** O assunto da vez vira um cartão 4:5, com o grifo e as capas, pra mandar pra alguém. */
  const makeCard = useCallback(async () => {
    const moment = moments[active];
    if (!moment || card === "busy") return;
    setCard("busy");
    try {
      const file = await renderCard(cardFromMoment(moment), getComputedStyle(document.body).fontFamily);
      const outcome = await deliverCard(file);
      setCard(outcome === "saved" ? "saved" : "idle");
    } catch {
      setCard("failed");
    }
  }, [active, card, moments]);

  return (
    <div ref={stageRef} className={styles.stage}>
      {masthead}
      {[...moments, null].map((moment, index) => {
        const isActive = index === active;
        const isDismissed = dismissed.includes(index);
        const isExpanded = expanded.includes(index);
        const refs = register(index);
        const evidence = moment?.evidence ?? null;
        return (
          <section
            id={`assunto-${index}`}
            key={moment?.key ?? "fim"}
            ref={refs("block")}
            data-index={index}
            className={styles.block}
            data-active={isActive}
            data-dismissed={isDismissed}
            data-end={!moment || undefined}
            aria-current={isActive ? "step" : undefined}
          >
            <Fala
              level={index === 0 ? 1 : 2}
              window={moment?.window}
              headline={moment?.headline ?? ending.headline}
              narrative={moment?.narrative ?? ending.narrative}
              insight={moment?.insight}
              closing={moment?.closing}
              reply={REPLY}
              active={isActive}
              dismissed={isDismissed}
              marked={pen.started.has(`${index}:grifo`)}
              headlineRef={refs("headline")}
              markRef={refs("mark")}
              mark={marksOf(evidence)}
              claims={isActive && !isDismissed ? claimsOf(evidence) : undefined}
              claimRef={(id) => refs(`claim:${id}`)}
              onClaim={(id) => setPointing(id ? { index, id } : null)}
              claimOn={pointing?.index === index ? pointing.id : null}
            />

            {/* riscado o assunto, a prova continua ali, apagada: o dado não deixou de ser verdade */}
            {evidence?.kind === "transition" && (
              <ProvaTransicao
                evidence={evidence}
                expanded={isExpanded}
                playingSide={isActive ? playingSide : null}
                glow={isActive && !isDismissed}
                register={refs}
              />
            )}
            {evidence?.kind === "ranking" && (
              <ProvaLista
                evidence={evidence}
                expanded={isExpanded}
                playing={isActive && sound.playing}
                lit={!isDismissed && pen.done.has(`${index}:regua`)}
                glow={isActive && !isDismissed}
                register={refs}
              />
            )}
            {evidence?.kind === "decades" && (
              <ProvaDecadas
                evidence={evidence}
                lit={isDismissed ? [] : evidence.focus.filter((decade) => pen.done.has(`${index}:regua:${decade}`))}
                register={refs}
              />
            )}
            {evidence?.kind === "loop" && <ProvaLoop evidence={evidence} playing={isActive && sound.playing} />}
            {evidence?.kind === "comeback" && <ProvaVolta evidence={evidence} playing={isActive && sound.playing} />}
            {evidence?.kind === "outlier" && <ProvaSurpresa evidence={evidence} playing={isActive && sound.playing} />}
            {evidence?.kind === "debut" && <ProvaEstreia evidence={evidence} playing={isActive && sound.playing} />}
            {evidence?.kind === "night" && <ProvaMadrugada evidence={evidence} playing={isActive && sound.playing} />}
            {evidence?.kind === "binge" && <ProvaMaratona evidence={evidence} playing={isActive && sound.playing} />}
            {/* o fio conferido: a lista do que ele contou hoje, com o que você fez com cada assunto */}
            {!moment && moments.length > 1 && (
              <div className={styles.fio}>
                <p className={styles.fioTitle}>o fio de hoje</p>
                <ol>
                  {moments.map((item, position) => (
                    <li key={item.key} data-gone={dismissed.includes(position) || undefined}>
                      <button type="button" onClick={() => go(position)}>
                        <span ref={register(moments.length)(`fio:${position}`)}>{item.headline}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}
            {!moment && epilogue}
          </section>
        );
      })}

      <PenLayer pen={{ ...pen, notes }} signal={signal} reduced={reduced} />

      <Respostas>
        {editorialError && <p className={styles.position} role="alert">{editorialError}</p>}
        {sound.error && <p className={styles.position} role="alert">{sound.error}</p>}
        {/* onde estou no fio: o texto e as marcas dos assuntos, que também levam até eles */}
        <div className={styles.thread}>
          <p className={styles.position} aria-live="polite" aria-atomic="true">
            {atEnd ? "Fim da conversa" : `p. ${active + 1} de ${moments.length}`}
            {/* a janela já está no alto do assunto, e o "toca aí" já diz que há prévia: no celular, some */}
            {!atEnd && <span className={styles.positionExtra}>{` · ${moments[active]?.window ?? ""}${steps.length > 0 ? " · prévia de 30s" : " · sem prévia neste assunto"}`}</span>}
          </p>
          {!atEnd && !activeDismissed && <button type="button" className={styles.cardButton} onClick={() => void makeCard()} disabled={card === "busy"}>
            {card === "busy" ? "montando o cartão…" : card === "saved" ? "cartão salvo ✓" : card === "failed" ? "não deu. tenta de novo" : "virar cartão ↓"}
          </button>}
          {/* o índice em mini-capas: a da vez acesa, as vistas apagadas, as dispensadas riscadas */}
          <div className={styles.ticks} role="group" aria-label="Assuntos da conversa">
            {moments.map((moment, index) => {
              const cover = coverOf(moment.evidence);
              return (
                <button key={moment.key} type="button" aria-label={`Ir ao assunto ${index + 1}: ${moment.headline}`} aria-pressed={index === active}
                  data-seen={seen.includes(index) || undefined} data-dismissed={dismissed.includes(index) || undefined} onClick={() => go(index)}>
                  {cover
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={coverProxyUrl(cover) ?? undefined} alt="" loading="lazy" />
                    : <i>{moment.evidence?.kind === "decades" ? "’" + String(moment.evidence.bars[0]?.decade ?? "").slice(2, 4) : index + 1}</i>}
                </button>
              );
            })}
          </div>
        </div>
        {atEnd ? (
          <>
            <Resposta onClick={() => go(0)} hint="↵">
              de novo
            </Resposta>
            {endReplies ?? <Resposta href="/discovery">seguir descobrindo</Resposta>}
            {/* a retrospectiva mora no fim do fio: é ele contando o ano, depois de contar a semana */}
            <Resposta href="/year">teu ano, em capítulos</Resposta>
            <Resposta href="/taste-evolution">o que mudou</Resposta>
          </>
        ) : (
          <>
            {/* o que não dá pra fazer neste assunto não ocupa lugar: o texto acima já diz que não há prévia */}
            {steps.length > 0 && <Resposta onClick={toggleSound} disabled={activeDismissed} hint="T">
              {sound.loading ? "carregando prévia…" : sound.playing ? "para aí" : "toca aí"}
            </Resposta>}
            <Resposta onClick={() => go(active + 1)} hint="→" primary>
              e o que mais?
            </Resposta>
            {canExpand && <Resposta onClick={toggleMore} hint="M" expanded={expanded.includes(active)} controls={`assunto-${active}`}>
              {expanded.includes(active) ? "menos" : "me mostra mais"}
            </Resposta>}
            <Resposta onClick={dismiss} hint="N">
              {activeDismissed ? "volta atrás" : "nada a ver"}
            </Resposta>
          </>
        )}
      </Respostas>
    </div>
  );
}
