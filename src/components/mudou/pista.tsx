import type { Ref } from "react";
import type { Point } from "@/components/amigo/gestures";
import { genreLabel } from "@/lib/format/genre";
import type { GenreRace } from "@/modules/statistics/domain/genre-race";
import styles from "./mudou.module.css";

/*
 * A pista dos gêneros: o amarelo dele é de faixa de pista, então os
 * gêneros correm numa. Cada raia é uma posição, mês a mês. Tudo em tinta;
 * o gênero que ele cita é desenhado pelo traço dele, por cima, a partir da
 * mesma geometria que este arquivo usa pra desenhar as linhas.
 */

export const RACE_VIEW = { width: 720, lane: 46, top: 26, left: 40, right: 168, bottom: 46 } as const;

const xAt = (index: number, count: number) =>
  RACE_VIEW.left + (count <= 1 ? 0 : (index * (RACE_VIEW.width - RACE_VIEW.left - RACE_VIEW.right)) / (count - 1));
const yAt = (place: number) => RACE_VIEW.top + (place - 1) * RACE_VIEW.lane;

export function raceHeight(lanes: number): number {
  return RACE_VIEW.top + Math.max(0, lanes - 1) * RACE_VIEW.lane + RACE_VIEW.bottom;
}

/**
 * Os trechos de uma raia, em coordenadas da pista: uma curva em S de mês a
 * mês, quebrada onde o gênero saiu da pista. Polilinha, porque o traço
 * precisa do comprimento exato. Função pura.
 */
export function laneStrokes(places: Array<number | null>, steps = 14): Point[][] {
  const strokes: Point[][] = [];
  let stroke: Point[] = [];
  places.forEach((place, index) => {
    if (place === null) {
      if (stroke.length > 1) strokes.push(stroke);
      stroke = [];
      return;
    }
    const to = { x: xAt(index, places.length), y: yAt(place) };
    const previous = index > 0 ? places[index - 1] : null;
    if (previous === null || stroke.length === 0) {
      stroke = [to];
      return;
    }
    const from = { x: xAt(index - 1, places.length), y: yAt(previous) };
    const mid = (from.x + to.x) / 2;
    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      const u = 1 - t;
      // bézier cúbica com os controles na metade: sai e chega na horizontal, como raia de pista
      stroke.push({ x: u * u * u * from.x + 3 * u * u * t * mid + 3 * u * t * t * mid + t * t * t * to.x, y: u * u * u * from.y + 3 * u * u * t * from.y + 3 * u * t * t * to.y + t * t * t * to.y });
    }
  });
  if (stroke.length > 1) strokes.push(stroke);
  return strokes;
}

const pathOf = (stroke: Point[]) => stroke.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join("");

function monthWord(month: string): string {
  const [year, index] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "short" }).format(new Date(Date.UTC(year, index - 1, 1))).replace(".", "");
}

export function Pista({ race, cited, svgRef, lit }: {
  race: GenreRace;
  /** O gênero que o traço dele percorre. */
  cited: string | null;
  svgRef: Ref<SVGSVGElement>;
  /** O traço já terminou de percorrer: a raia citada acende. */
  lit: boolean;
}) {
  const height = raceHeight(race.lanes.length);
  const last = race.months.length - 1;
  const described = race.lanes.map((lane) => {
    const first = lane.places.find((place) => place !== null);
    const end = lane.places[last];
    return `${genreLabel(lane.genre)}: ${first ?? "fora"}º em ${monthWord(race.months[0])}, ${end ?? "fora da pista"}${end ? "º" : ""} em ${monthWord(race.months[last])}`;
  }).join("; ");
  return (
    <figure className={styles.race}>
      <svg ref={svgRef} viewBox={`0 0 ${RACE_VIEW.width} ${height}`} role="img" aria-label={`Posição dos gêneros mês a mês. ${described}.`}>
        {race.lanes.map((_, index) => (
          <g key={index}>
            <rect className={styles.raceLane} x={RACE_VIEW.left - 14} y={yAt(index + 1) - RACE_VIEW.lane / 2 + 3} width={RACE_VIEW.width - RACE_VIEW.left - RACE_VIEW.right + 28} height={RACE_VIEW.lane - 6} />
            <text className={styles.raceNumber} x={10} y={yAt(index + 1) + 5}>{index + 1}</text>
          </g>
        ))}
        {race.lanes.map((lane) => {
          const isCited = lane.genre === cited;
          const end = lane.places[last];
          return (
            <g key={lane.genre} data-cited={isCited || undefined} data-lit={(isCited && lit) || undefined} className={styles.raceRunner}>
              {/* a raia citada fica por baixo em tinta fraca: quem pinta ela é o traço dele */}
              {laneStrokes(lane.places).map((stroke, index) => <path key={index} d={pathOf(stroke)} />)}
              {end !== null && <circle cx={xAt(last, race.months.length)} cy={yAt(end)} r={isCited ? 6 : 4} />}
              {end !== null && <text x={RACE_VIEW.width - RACE_VIEW.right + 20} y={yAt(end) + 5}>{genreLabel(lane.genre)}</text>}
            </g>
          );
        })}
        {race.months.map((month, index) => (
          <text key={month} className={styles.raceMonth} x={xAt(index, race.months.length)} y={height - 6} textAnchor="middle">{monthWord(month)}</text>
        ))}
      </svg>
      <figcaption className={styles.quiet}>raia = posição no mês, pelo tempo ouvido entre os gêneros conhecidos · o ponto é onde cada um tá agora</figcaption>
    </figure>
  );
}
