"use client";

import { Capa } from "@/components/amigo/fala";
import { shorten } from "@/components/amigo/measure";
import type { Evidence } from "@/modules/conversation/domain/conversation.types";
import styles from "./conversa.module.css";

/*
 * As provas da conversa, sempre na tela e em repouso: cinza, paradas,
 * sem cor própria. O amigo não as revela — acende o pedaço que importa.
 * Cada prova registra as peças que o traço dele precisa medir.
 */

type Register = (part: string) => (node: HTMLElement | null) => void;

const decimal = (value: number) => value.toString().replace(".", ",");

/** "anos 80", "anos 2000": do jeito que se fala. */
export function decadeLabel(decade: number): string {
  return decade < 2000 ? `anos ${String(decade).slice(2)}` : `anos ${decade}`;
}

export function ProvaTransicao({
  evidence,
  expanded,
  playingSide,
  register,
}: {
  evidence: Extract<Evidence, { kind: "transition" }>;
  expanded: boolean;
  playingSide: "from" | "to" | null;
  register: Register;
}) {
  const sequence = [
    ...evidence.context.before.map((entry) => ({ ...entry, jump: false })),
    { ...evidence.from, jump: true },
    { ...evidence.to, jump: true },
    ...evidence.context.after.map((entry) => ({ ...entry, jump: false })),
  ];
  return (
    <div className={styles.proof}>
      <div className={styles.pair}>
        {(["from", "to"] as const).map((side) => {
          const entry = evidence[side];
          return (
            <figure className={styles.side} data-side={side} key={side}>
              <Capa cover={entry.cover} playing={playingSide === side} innerRef={register(side)} />
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
      {expanded && (
        <ol className={styles.sequence} aria-label="O que tocou antes e depois">
          {sequence.map((entry, order) => (
            <li key={`${entry.when}-${order}`} data-jump={entry.jump}>
              <span className={styles.when}>{entry.when.split(" · ")[1] ?? entry.when}</span>
              <span className={styles.sequenceTrack}>{entry.track}</span>
              <span className={styles.who}>{entry.artist}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * O que o amigo escreve embaixo da linha citada: a fatia, se a frase fala
 * em porcentagem; senão a distância para a segunda, ou o empate.
 */
export function rankingNote(evidence: Extract<Evidence, { kind: "ranking" }>): string {
  const { rows, focusIndex } = evidence;
  if (evidence.citesShare) return `${decimal(evidence.share)}% de tudo`;
  const runnerUp = rows.find((_, index) => index !== focusIndex);
  if (focusIndex !== 0 || !runnerUp) return "é esse aqui";
  const lead = rows[focusIndex].plays - runnerUp.plays;
  return lead > 0 ? `+${lead} que ${shorten(runnerUp.label)}` : `empatado com ${shorten(runnerUp.label)}`;
}

export function ProvaLista({
  evidence,
  expanded,
  playing,
  lit,
  register,
}: {
  evidence: Extract<Evidence, { kind: "ranking" }>;
  expanded: boolean;
  playing: boolean;
  lit: boolean;
  register: Register;
}) {
  const visible = expanded ? evidence.rows.length : Math.max(5, evidence.focusIndex + 1);
  const max = evidence.rows[0]?.plays || 1;
  return (
    <div className={styles.proof}>
      <div className={styles.solo}>
        <Capa cover={evidence.cover} playing={playing} className={styles.soloCover} />
        <ol className={styles.rows}>
          {evidence.rows.slice(0, visible).map((row, index) => {
            const focus = index === evidence.focusIndex;
            return (
              <li key={`${row.sub}-${row.label}`} className={styles.row} data-lit={focus && lit}>
                <span className={styles.rowRank}>{index + 1}</span>
                <span className={styles.rowText}>
                  <span className={styles.rowLabel}>{row.label}</span>
                  {row.sub && <span className={styles.rowSub}>{row.sub}</span>}
                </span>
                <span className={styles.rowValue}>{row.plays}</span>
                <span className={styles.rowBar}>
                  <span ref={focus ? register("bar") : undefined} style={{ width: `${(row.plays / max) * 100}%` }} />
                </span>
                {focus && <span className={styles.rowNote}>{rankingNote(evidence)}</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

/** As décadas em ordem de calendário, não de ranking: a linha não tem posição. */
export function ProvaDecadas({
  evidence,
  lit,
  register,
}: {
  evidence: Extract<Evidence, { kind: "decades" }>;
  /** As décadas que a régua dele já cobriu. */
  lit: number[];
  register: Register;
}) {
  const max = Math.max(...evidence.bars.map((bar) => bar.share), 1);
  const lastFocus = evidence.focus[evidence.focus.length - 1];
  return (
    <div className={styles.proof}>
      <ol className={styles.rows} data-plain="true">
        {evidence.bars.map((bar) => {
          const focus = evidence.focus.includes(bar.decade);
          return (
            <li key={bar.decade} className={styles.row} data-lit={focus && lit.includes(bar.decade)}>
              <span className={styles.rowText}>
                <span className={styles.rowLabel}>{decadeLabel(bar.decade)}</span>
                <span className={styles.rowSub}>
                  {bar.plays} {bar.plays === 1 ? "audição" : "audições"}
                </span>
              </span>
              <span className={styles.rowValue}>{decimal(bar.share)}%</span>
              <span className={styles.rowBar}>
                <span
                  ref={focus ? register(`bar:${bar.decade}`) : undefined}
                  style={{ width: `${(bar.share / max) * 100}%` }}
                />
              </span>
              {focus && bar.decade === lastFocus && evidence.focus.length > 1 && (
                <span className={styles.rowNote}>somam {decimal(evidence.focusShare)}%</span>
              )}
            </li>
          );
        })}
      </ol>
      <p className={styles.quiet}>ano de lançamento conhecido em {evidence.coverage}% das audições</p>
    </div>
  );
}
