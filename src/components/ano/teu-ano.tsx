"use client";

import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Aviso } from "@/components/amigo/aviso";
import { Capa, Fala, PenLayer, Resposta, Respostas } from "@/components/amigo/fala";
import { band, circle, frame } from "@/components/amigo/gestures";
import { boxOf, textLines } from "@/components/amigo/measure";
import { Risquinhos } from "@/components/amigo/risquinhos";
import type { TraceGesture } from "@/components/amigo/trace";
import { usePen } from "@/components/amigo/use-pen";
import { deliverCard, renderCard } from "@/components/conversa/cartao";
import { privateFetch } from "@/lib/http/private-fetch";
import type { YearReview } from "@/modules/statistics/application/year-review";
import type { YearChapter } from "@/modules/statistics/domain/year-chapters";
import styles from "./teu-ano.module.css";

const count = (value: number) => value.toLocaleString("pt-BR");

/**
 * Teu ano, em capítulos: uma tela por vez, como quem conta uma história.
 * Cada capítulo é a fala dele com a prova; a caneta grifa a frase e
 * circula o número. "e depois?" passa, as setas também. Nada toca sozinho
 * e nada passa sozinho: o ritmo é de quem lê.
 */
export function TeuAno() {
  const reduced = Boolean(useReducedMotion());
  const [data, setData] = useState<YearReview | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [at, setAt] = useState(0);
  const [card, setCard] = useState<"idle" | "busy" | "saved" | "failed">("idle");
  const stage = useRef<HTMLDivElement>(null);
  const mark = useRef<HTMLSpanElement>(null);
  const proof = useRef<HTMLElement>(null);
  const headline = useRef<HTMLHeadingElement>(null);
  const silence = useRef<ArrayLike<number> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    privateFetch("/api/year", { signal: controller.signal, cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error(`year ${response.status}`); return response.json() as Promise<YearReview>; })
      .then((payload) => { if (!controller.signal.aborted) setData(payload); })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [attempt]);

  const chapters = data?.chapters ?? [];
  const chapter: YearChapter | undefined = chapters[at];
  const last = at >= chapters.length - 1;
  const ink = `ano:${chapter?.id ?? ""}`;

  const pen = usePen(stage, (origin) => {
    const gestures: TraceGesture[] = [];
    if (mark.current) {
      const { lines, size } = textLines(mark.current, origin);
      if (lines.length > 0) {
        const { strokes, width } = band(lines, size);
        gestures.push({ id: `${ink}:grifo`, layer: "under", strokes, width, cap: "butt" });
      }
    }
    if (proof.current) {
      const box = boxOf(proof.current, origin);
      // número, ele circula; capa, ele emoldura por fora, como a foto do retrato: círculo cortaria a arte
      const stroke = chapter?.proof.kind === "cover" ? frame(box, 8) : circle(box, ink, 12);
      gestures.push({ id: `${ink}:prova`, layer: "over", strokes: [stroke], width: 2, cap: "round" });
    }
    return { gestures, wave: null, notes: [] };
  }, ink);

  const go = useCallback((next: number) => {
    setAt(Math.max(0, Math.min(chapters.length - 1, next)));
    setCard("idle");
    // o capítulo novo começa do topo, e quem usa leitor de tela ouve a frase nova
    requestAnimationFrame(() => headline.current?.focus({ preventScroll: true }));
  }, [chapters.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("input, textarea, select, button, a, summary, [contenteditable='true']")) return;
      if (event.key === "ArrowRight") { event.preventDefault(); go(at + 1); }
      else if (event.key === "ArrowLeft") { event.preventDefault(); go(at - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [at, go]);

  const keep = useCallback(async () => {
    if (!chapter || !data || card === "busy") return;
    setCard("busy");
    try {
      const covers = chapter.proof.kind === "cover" ? [{ url: chapter.proof.coverUrl, title: chapter.proof.title, artist: chapter.proof.artist }] : [];
      const file = await renderCard({ window: `${data.year} · ${chapter.title}`, headline: chapter.headline, narrative: chapter.narrative, marks: [chapter.mark], covers },
        getComputedStyle(document.body).fontFamily);
      setCard((await deliverCard(file)) === "saved" ? "saved" : "idle");
    } catch {
      setCard("failed");
    }
  }, [card, chapter, data]);

  if (failed && !data) {
    return <Aviso headline="Me perdi no teu ano." narrative="Deu erro do meu lado juntando os meses. Tenta de novo?">
      <Resposta onClick={() => setAttempt((value) => value + 1)}>tenta de novo</Resposta>
    </Aviso>;
  }
  if (!data) return <Aviso waiting headline="Peraí, tô juntando teu ano." />;
  if (!chapter) {
    return <Aviso headline="Ainda não tem ano pra contar." narrative="Quando tiver música tua por aqui, eu volto com os capítulos.">
      <Resposta href="/overview">voltar pra conversa</Resposta>
    </Aviso>;
  }

  const { proof: evidence } = chapter;
  return (
    <div ref={stage} className={styles.stage}>
      <ol className={styles.progress} aria-label={`Capítulo ${at + 1} de ${chapters.length}`}>
        {chapters.map((item, index) => (
          <li key={item.id} data-state={index < at ? "lido" : index === at ? "agora" : "depois"}>
            <button type="button" onClick={() => go(index)} aria-label={`Ir ao capítulo ${index + 1}: ${item.title}`} aria-current={index === at ? "step" : undefined}><i /></button>
          </li>
        ))}
      </ol>
      <section key={chapter.id} className={styles.chapter} aria-live="polite">
        <Fala level={1} window={`${data.year}${data.ongoing ? ", até aqui" : ""} · ${chapter.title}`} headline={chapter.headline} narrative={chapter.narrative}
          mark={[chapter.mark]} markRef={mark} headlineRef={headline} marked={pen.started.has(`${ink}:grifo`)} className={styles.fala} />
        <div className={styles.proof}>
          {evidence.kind === "number" && <figure className={styles.number}>
            <strong ref={proof as React.RefObject<HTMLElement>}>{count(evidence.value)}</strong>
            <figcaption>{evidence.label}</figcaption>
          </figure>}
          {evidence.kind === "hour" && <figure className={styles.number}>
            <strong ref={proof as React.RefObject<HTMLElement>}>{String(evidence.hour).padStart(2, "0")}h</strong>
            <figcaption>a hora que mais toca</figcaption>
          </figure>}
          {evidence.kind === "cover" && <figure className={styles.record}>
            <Capa cover={{ url: evidence.coverUrl, title: evidence.title, artist: evidence.artist }} className={styles.cover} innerRef={proof as React.RefObject<HTMLDivElement>} glow eager />
            <figcaption>
              <span className={styles.recordTitle}>{evidence.title}</span>
              <span className={styles.recordArtist}>{evidence.artist}</span>
              <span className={styles.tally}>
                <Risquinhos count={evidence.tally} lit={pen.done.has(`${ink}:prova`)} label={evidence.tallyLabel} />
                <span data-lit={pen.done.has(`${ink}:prova`)}>{evidence.tallyLabel}</span>
              </span>
            </figcaption>
          </figure>}
        </div>
      </section>
      <Respostas label="Capítulos">
        {at > 0 && <Resposta onClick={() => go(at - 1)} hint="←">volta</Resposta>}
        {last
          ? <Resposta href="/overview" primary>voltar pra conversa</Resposta>
          : <Resposta onClick={() => go(at + 1)} hint="→" primary>e depois?</Resposta>}
        <Resposta onClick={() => void keep()} disabled={card === "busy"}>
          {card === "busy" ? "montando o cartão…" : card === "saved" ? "cartão salvo ✓" : card === "failed" ? "não deu. tenta de novo" : "guarda esse"}
        </Resposta>
      </Respostas>
      <PenLayer pen={pen} signal={silence} reduced={reduced} />
    </div>
  );
}
