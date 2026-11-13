"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type CSSProperties, type ReactNode, type Ref, type RefObject } from "react";
import { coverProxyUrl } from "@/lib/cover";
import { readTint, type Tint } from "@/lib/cover-tint";
import { knownTint, rememberTint } from "./use-cover-tint";
import { markPieces } from "./measure";
import { Trace } from "./trace";
import type { Pen } from "./use-pen";
import styles from "./amigo.module.css";

/*
 * As peças da voz do amigo, iguais em todas as telas: a fala (janela,
 * manchete com o trecho que ele grifa, narrativa, o detalhe), as respostas,
 * a capa e a camada do traço com o que ele escreve.
 */

export function Fala({
  window: when,
  headline,
  narrative,
  insight,
  closing,
  reply,
  active = true,
  dismissed = false,
  marked = false,
  headlineRef,
  markRef,
  mark,
  level = 2,
  className = "",
}: {
  /** A janela de tempo, dita por ele; pode trazer a escolha de outra janela. */
  window?: ReactNode;
  headline: string;
  narrative?: string | null;
  insight?: string | null;
  closing?: string | null;
  /** O que ele responde quando você manda esquecer. */
  reply?: string;
  active?: boolean;
  dismissed?: boolean;
  /** A faixa já passou por baixo do trecho: a letra fica escura sobre ela. */
  marked?: boolean;
  headlineRef?: Ref<HTMLHeadingElement>;
  markRef?: Ref<HTMLSpanElement>;
  /** O que a prova sustenta, em ordem de preferência: o grifo vai no primeiro que a frase cita. */
  mark?: string[];
  level?: 1 | 2;
  className?: string;
}) {
  const pieces = markPieces(headline, mark);
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div className={`${styles.fala} ${className}`} data-active={active} data-dismissed={dismissed}>
      {when && <p className={styles.window}>{when}</p>}
      <Heading ref={headlineRef} className={styles.headline}>
        {pieces.before}
        <span ref={markRef} className={styles.mark} data-marked={marked}
          data-space-before={/\s$/.test(pieces.before) || undefined} data-space-after={/^\s/.test(pieces.after) || undefined}>
          {pieces.marked}
        </span>
        {pieces.after}
      </Heading>
      {dismissed && reply ? (
        <p className={styles.reply}>{reply}</p>
      ) : (
        narrative && <p className={styles.narrative}>{narrative}</p>
      )}
      {!dismissed && (insight || closing) && (
        <div className={styles.aside}>
          {insight && <p className={styles.insight}>{insight}</p>}
          {closing && <p className={styles.closing}>{closing}</p>}
        </div>
      )}
    </div>
  );
}

/**
 * As respostas ficam presas no pé da tela enquanto a conversa rola; num
 * aviso curto, `inline` as deixa logo abaixo da fala.
 */
export function Respostas({
  children,
  label = "Responder",
  inline = false,
}: {
  children: ReactNode;
  label?: string;
  inline?: boolean;
}) {
  return (
    <nav className={styles.reactions} aria-label={label} data-inline={inline || undefined}>
      {children}
    </nav>
  );
}

export function Resposta({
  onClick,
  disabled = false,
  pressed,
  hint,
  href,
  download,
  submit = false,
  primary = false,
  expanded,
  controls,
  children,
}: {
  onClick?: () => void;
  disabled?: boolean;
  pressed?: boolean;
  /** A tecla que faz o mesmo. */
  hint?: string;
  href?: string;
  download?: boolean;
  /** Envia o formulário em volta. */
  submit?: boolean;
  primary?: boolean;
  expanded?: boolean;
  controls?: string;
  children: ReactNode;
}) {
  const body = (
    <>
      {children}
      {hint && <span className={styles.key}>{hint}</span>}
    </>
  );
  if (href && download) {
    return (
      <a className={styles.reaction} href={href} download>
        {body}
      </a>
    );
  }
  // fora do Arcadium (Spotify, Apple Music): outra aba, a conversa fica onde estava
  if (href && /^https?:/.test(href)) {
    return (
      <a className={styles.reaction} href={href} target="_blank" rel="noreferrer">
        {body}
      </a>
    );
  }
  if (href) {
    return (
      <Link className={styles.reaction} href={href}>
        {body}
      </Link>
    );
  }
  return (
    <button
      type={submit ? "submit" : "button"}
      className={styles.reaction}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-expanded={expanded}
      aria-controls={controls}
      data-primary={primary || undefined}
    >
      {body}
    </button>
  );
}

/** Até duas iniciais do título, ignorando artigos e o que vem entre parênteses. */
export function initials(title: string): string {
  const words = title.replace(/\s*[([].*?[)\]]/g, "").split(/[\s\-–—/&·]+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word) && !/^(a|as|o|os|the|de|da|do|das|dos|e|of|and)$/i.test(word));
  const letters = words.slice(0, 2).map((word) => [...word.replace(/[^\p{L}\p{N}]/gu, "")][0] ?? "");
  return letters.join("").toUpperCase() || "·";
}

export interface CoverData {
  url: string | null | undefined;
  title: string;
  artist?: string;
}

/**
 * A capa, reta, sem inclinação: é imagem da música, não objeto de cena.
 * Pulsa com o nível da música quando é ela que está tocando. Sem imagem,
 * o lugar dela é um vão honesto com o título.
 *
 * Com `glow`, a capa acende o papel em volta com a cor dela mesma: uma
 * luz baixa e uma sombra da própria arte. É a capa trazendo a cor; o
 * amarelo continua sendo só do traço.
 */
export function Capa({
  cover,
  playing = false,
  innerRef,
  className = "",
  eager = false,
  label = true,
  glow = false,
}: {
  cover: CoverData;
  playing?: boolean;
  innerRef?: Ref<HTMLDivElement>;
  className?: string;
  eager?: boolean;
  /** Sem imagem, escreve o título no vão; miniatura pequena demais fica só com o vão. */
  label?: boolean;
  /** A capa do assunto da vez: acende o papel em volta com a cor dela. */
  glow?: boolean;
}) {
  const src = coverProxyUrl(cover.url);
  const [state, setState] = useState<"loading" | "loaded" | "failed">(src ? "loading" : "failed");
  const [tint, setTint] = useState<Tint | null>(() => knownTint(cover.url) ?? null);
  useEffect(() => {
    setState(src ? "loading" : "failed");
    setTint(knownTint(cover.url) ?? null);
  }, [src, cover.url]);
  /** Carregou: a capa aparece e, uma vez por capa, a cor dela é medida. */
  const loaded = useCallback((image: HTMLImageElement) => {
    setState("loaded");
    if (!cover.url) return;
    let value = knownTint(cover.url);
    if (value === undefined) {
      value = readTint(image);
      rememberTint(cover.url, value);
    }
    setTint(value);
  }, [cover.url]);
  // capa que já estava no cache termina de carregar antes do onLoad existir
  const probe = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete && image.naturalWidth > 0) loaded(image);
  }, [loaded]);
  const lit = glow && state === "loaded" && tint !== null;

  return (
    <div ref={innerRef} className={`${styles.cover} ${className}`} data-playing={playing} data-glow={lit || undefined}
      style={tint ? ({ "--capa-luz": tint } as CSSProperties) : undefined}>
      {state === "failed" && label && <span className={styles.coverEmpty}>{cover.title}</span>}
      {/* miniatura pequena demais pro título: as iniciais do disco, pra a coluna não virar uma fila de quadrados vazios */}
      {state === "failed" && !label && <span className={styles.coverInitials} aria-hidden="true">{initials(cover.title)}</span>}
      {src && state !== "failed" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={probe}
          src={src}
          alt={cover.artist ? `${cover.title}, de ${cover.artist}` : cover.title}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          draggable={false}
          data-loaded={state === "loaded"}
          onLoad={(event) => loaded(event.currentTarget)}
          onError={() => setState("failed")}
        />
      )}
    </div>
  );
}

/** A camada do traço de uma tela e o que ele escreve fora da grade. */
export function PenLayer({
  pen,
  signal,
  reduced,
}: {
  pen: Pen;
  signal: RefObject<ArrayLike<number> | null>;
  reduced: boolean;
}) {
  return (
    <>
      <Trace
        plan={pen.plan}
        size={pen.size}
        penWidth={Math.max(1.5, Math.min(2.5, pen.size.width / 600))}
        reduced={reduced}
        readSignal={() => signal.current}
        onGesture={pen.onGesture}
        travelStyle="straight"
      />
      {pen.notes.map((note) => (
        <p
          key={`${note.id}:${Math.round(note.x)}:${Math.round(note.y)}:${note.pop ?? 0}`}
          className={styles.note}
          data-kind={note.kind}
          data-align={note.align ?? "center"}
          data-dim={note.dim || undefined}
          style={{ left: note.x, top: note.y }}
        >
          {note.text}
        </p>
      ))}
    </>
  );
}
