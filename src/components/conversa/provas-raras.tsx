"use client";

import { Capa } from "@/components/amigo/fala";
import type { Evidence } from "@/modules/conversation/domain/conversation.types";
import { splitTrackTitle } from "@/lib/music/track-title";
import styles from "./conversa.module.css";
import own from "./provas-raras.module.css";

/*
 * As provas do que só acontece de vez em quando: a faixa em loop, quem
 * voltou depois de um sumiço e o ponto fora da curva. O fato vem em
 * destaque ao lado da capa; embaixo, as audições ou a lista que o sustentam.
 */

const decimal = (value: number) => value.toString().replace(".", ",");

/** O loop: quantas vezes seguidas, e a hora de cada uma — é a sequência de verdade. */
export function ProvaLoop({ evidence, playing }: { evidence: Extract<Evidence, { kind: "loop" }>; playing: boolean }) {
  const [day] = evidence.plays[0]?.split(" · ") ?? [""];
  const sameDay = evidence.plays.every((when) => when.startsWith(`${day} · `));
  return (
    <div className={styles.proof}>
      <div className={styles.solo}>
        <Capa cover={evidence.cover} playing={playing} className={styles.soloCover} />
        <div className={own.fact}>
          <p className={own.value}>
            {evidence.times}× <span>seguidas</span>
          </p>
          <p className={own.name}>{splitTrackTitle(evidence.track).title}</p>
          <p className={styles.who}>{evidence.artist}</p>
          <ol className={own.plays} aria-label="A hora de cada vez que tocou">
            {sameDay && <li className={own.playsDay}>{day}</li>}
            {evidence.plays.map((when, order) => (
              <li key={`${when}-${order}`} className={styles.when}>
                {sameDay ? when.split(" · ")[1] : when}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/** A volta: a última vez antes do sumiço, a primeira depois, e o tempo entre as duas. */
export function ProvaVolta({ evidence, playing }: { evidence: Extract<Evidence, { kind: "comeback" }>; playing: boolean }) {
  return (
    <div className={styles.proof}>
      <div className={styles.solo}>
        <Capa cover={evidence.cover} playing={playing} className={styles.soloCover} />
        <div className={own.fact}>
          <p className={own.value}>
            {evidence.awayFor} <span>sem tocar</span>
          </p>
          <p className={own.name}>{evidence.artist}</p>
          <dl className={own.dates}>
            <div>
              <dt>a última vez antes</dt>
              <dd>{evidence.lastBefore}</dd>
            </div>
            <div data-lit="true">
              <dt>voltou</dt>
              <dd>{evidence.firstBack}</dd>
            </div>
          </dl>
          <p className={styles.quiet}>
            {evidence.plays} {evidence.plays === 1 ? "audição" : "audições"} desde a volta
          </p>
        </div>
      </div>
    </div>
  );
}

/** A estreia: a primeira audição da vida, com a hora e a faixa por onde ele entrou. */
export function ProvaEstreia({ evidence, playing }: { evidence: Extract<Evidence, { kind: "debut" }>; playing: boolean }) {
  return (
    <div className={styles.proof}>
      <div className={styles.solo}>
        <Capa cover={evidence.cover} playing={playing} className={styles.soloCover} />
        <div className={own.fact}>
          <p className={own.value}>
            1ª vez <span>por aqui</span>
          </p>
          <p className={own.name}>{evidence.artist}</p>
          <dl className={own.dates}>
            <div data-lit="true">
              <dt>entrou com {splitTrackTitle(evidence.firstTrack).title}</dt>
              <dd>{evidence.firstAt}</dd>
            </div>
          </dl>
          <p className={styles.quiet}>
            {evidence.plays} {evidence.plays === 1 ? "audição" : "audições"} desde então
          </p>
        </div>
      </div>
    </div>
  );
}

/** A madrugada: de que hora a que hora, e o que tocou, na ordem. */
export function ProvaMadrugada({ evidence, playing }: { evidence: Extract<Evidence, { kind: "night" }>; playing: boolean }) {
  const rest = evidence.plays - evidence.steps.length;
  const [day] = evidence.steps[0]?.when.split(" · ") ?? [""];
  return (
    <div className={styles.proof}>
      <div className={styles.solo}>
        <Capa cover={evidence.cover} playing={playing} className={styles.soloCover} />
        <div className={own.fact}>
          <p className={own.value}>
            {evidence.from}–{evidence.to} <span>{day}</span>
          </p>
          <ol className={own.steps} aria-label="O que tocou de madrugada">
            {evidence.steps.map((step, order) => (
              <li key={`${step.when}-${order}`}>
                <span className={styles.when}>{step.when.split(" · ")[1] ?? step.when}</span>
                <span className={own.stepTrack}>{splitTrackTitle(step.track).title}</span>
                <span className={styles.who}>{step.artist}</span>
              </li>
            ))}
          </ol>
          <p className={styles.quiet}>
            {evidence.plays} audições seguidas{rest > 0 ? ` · e mais ${rest} depois dessas` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

/** A maratona: quantas das audições de um dia foram de um artista só, e com quais faixas. */
export function ProvaMaratona({ evidence, playing }: { evidence: Extract<Evidence, { kind: "binge" }>; playing: boolean }) {
  const max = evidence.tracks[0]?.plays || 1;
  return (
    <div className={styles.proof}>
      <div className={styles.solo}>
        <Capa cover={evidence.cover} playing={playing} className={styles.soloCover} />
        <div className={own.fact}>
          <p className={own.value}>
            {evidence.plays} de {evidence.dayTotal} <span>audições em {evidence.day}</span>
          </p>
          <p className={own.name}>{evidence.artist}</p>
          <ol className={`${styles.rows} ${own.spaced}`} data-plain="true">
            {evidence.tracks.map((row) => (
              <li key={row.track} className={styles.row}>
                <span className={styles.rowText}>
                  <span className={styles.rowLabel}>{splitTrackTitle(row.track).title}</span>
                </span>
                <span className={styles.rowValue}>{row.plays}</span>
                <span className={styles.rowBar}>
                  <span style={{ width: `${(row.plays / max) * 100}%` }} />
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/** A surpresa: os gêneros que dominam a janela e, fora deles, o artista que não conversa com nenhum. */
export function ProvaSurpresa({ evidence, playing }: { evidence: Extract<Evidence, { kind: "outlier" }>; playing: boolean }) {
  const max = Math.max(...evidence.dominant.map((entry) => entry.share), 1);
  return (
    <div className={styles.proof}>
      <div className={styles.solo}>
        <Capa cover={evidence.cover} playing={playing} className={styles.soloCover} />
        <ol className={styles.rows} data-plain="true">
          {evidence.dominant.map((entry) => (
            <li key={entry.genre} className={styles.row}>
              <span className={styles.rowText}>
                <span className={styles.rowLabel}>{entry.genre}</span>
              </span>
              <span className={styles.rowValue}>{decimal(entry.share)}%</span>
              <span className={styles.rowBar}>
                <span style={{ width: `${(entry.share / max) * 100}%` }} />
              </span>
            </li>
          ))}
          <li className={`${styles.row} ${own.apart}`} data-lit="true">
            <span className={styles.rowText}>
              <span className={styles.rowLabel}>{evidence.genre}</span>
              <span className={styles.rowSub}>{evidence.artist}</span>
            </span>
            <span className={styles.rowSub}>
              {evidence.plays} {evidence.plays === 1 ? "audição" : "audições"}
            </span>
            <span className={styles.rowNote}>fora de tudo isso</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
