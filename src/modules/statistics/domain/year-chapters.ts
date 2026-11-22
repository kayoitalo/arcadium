/*
 * Teu ano, em capítulos: o amigo contando o ano com o que o banco mediu.
 * Cada capítulo é uma frase curta com a prova dela — o mesmo contrato da
 * conversa. Sem dado que sustente, o capítulo não existe. Sem IA: as frases
 * saem dos números, na voz dele.
 */

import { cleanTitle } from "@/lib/music/track-title";
import { genreLabel } from "@/lib/format/genre";

export interface YearFacts {
  year: number;
  /** O ano ainda está correndo: "até aqui", não "o ano inteiro". */
  ongoing: boolean;
  /** Até que mês o ano foi contado: 12 num ano fechado, o mês corrente num ano em curso. */
  throughMonth: number;
  plays: number;
  artists: number;
  topArtist: { name: string; plays: number } | null;
  /** O nome que apareceu pela primeira vez neste ano e mais tocou. */
  newcomer: { name: string; plays: number; firstMonth: number } | null;
  topAlbum: { name: string; artist: string; plays: number; months: number; coverUrl: string | null } | null;
  peakHour: { hour: number; plays: number } | null;
  fullestMonth: { month: number; plays: number } | null;
  /** Audições por hora do dia, 0 a 23: o relógio do capítulo da hora. */
  hours?: number[];
  /** Audições por mês, janeiro a dezembro: a régua do capítulo do mês. */
  monthPlays?: number[];
  /** A corrida dos gêneros no ano: a posição de cada um, mês a mês. */
  race?: { months: string[]; lanes: Array<{ genre: string; places: Array<number | null>; shares: number[] }> } | null;
}

export type ChapterProof =
  /** Com `artist`, o número vem com a foto de quem ele conta. */
  | { kind: "number"; value: number; label: string; artist?: string }
  | { kind: "cover"; title: string; artist: string; coverUrl: string | null; tally: number; tallyLabel: string }
  | { kind: "hour"; hour: number; plays: number; hours: number[] }
  | { kind: "months"; month: number; value: number; plays: number[] }
  /** A classificação dos gêneros mês a mês; `genre` é o que mais subiu, de `from` a `to`. */
  | { kind: "race"; genre: string; from: number; to: number; months: string[]; lanes: Array<{ genre: string; places: Array<number | null>; shares: number[] }> };

export interface YearChapter {
  id: string;
  /** O nome do capítulo, em minúscula: "o ano numa frase". */
  title: string;
  headline: string;
  /** O pedaço da frase que a prova sustenta: é ali que ele grifa. */
  mark: string;
  narrative: string;
  proof: ChapterProof;
  /** O mês que o capítulo acende na fita do ano, quando ele fala de um mês. */
  month?: number;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const count = (value: number) => value.toLocaleString("pt-BR");
const monthName = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1] ?? key;

/** Quem mais subiu do primeiro ao último mês em que correu; no empate, quem terminou na frente. */
function biggestClimbOf(lanes: Array<{ genre: string; places: Array<number | null> }>): { genre: string; from: number; to: number } | null {
  let best: { genre: string; from: number; to: number } | null = null;
  for (const lane of lanes) {
    const placed = lane.places.filter((place): place is number => place !== null);
    if (placed.length < 2) continue;
    const [from, to] = [placed[0], placed[placed.length - 1]];
    if (to >= from) continue;
    if (!best || from - to > best.from - best.to || (from - to === best.from - best.to && to < best.to)) best = { genre: lane.genre, from, to };
  }
  return best;
}
const hourWords = (hour: number) => (hour === 0 ? "meia-noite" : hour === 12 ? "meio-dia" : `${hour}h`);
/** A hora com a preposição certa: "ao meio-dia", "à meia-noite", "à 1h", "às 19h". */
export const atHour = (hour: number) => (hour === 12 ? "ao meio-dia" : hour === 0 ? "à meia-noite" : hour === 1 ? "à 1h" : `às ${hour}h`);

/** Os capítulos que o ano sustenta, na ordem em que ele conta. */
export function yearChapters(facts: YearFacts): YearChapter[] {
  if (facts.plays === 0) return [];
  const chapters: YearChapter[] = [];
  const span = facts.ongoing ? `${facts.year}, até aqui` : `${facts.year}`;

  if (facts.topArtist) {
    chapters.push({
      id: "frase", title: "o ano numa frase",
      headline: `${span} teve ${count(facts.plays)} audições, e quem mais voltou foi ${facts.topArtist.name}.`,
      mark: facts.topArtist.name,
      narrative: `Foram ${count(facts.artists)} nomes diferentes passando pelo fone. ${facts.topArtist.name} apareceu ${count(facts.topArtist.plays)} vezes.`,
      proof: { kind: "number", value: facts.plays, label: "audições", artist: facts.topArtist.name },
    });
  }
  if (facts.newcomer && facts.newcomer.name !== facts.topArtist?.name) {
    chapters.push({
      id: "chegou", title: "quem chegou",
      headline: `${facts.newcomer.name} nem existia pra ti antes de ${MONTHS[facts.newcomer.firstMonth - 1]}.`,
      mark: facts.newcomer.name,
      narrative: `Chegou esse ano e já são ${count(facts.newcomer.plays)} audições. De todo mundo que apareceu pela primeira vez, ninguém ficou tanto.`,
      proof: { kind: "number", value: facts.newcomer.plays, label: "audições desde que chegou", artist: facts.newcomer.name },
      month: facts.newcomer.firstMonth,
    });
  }
  if (facts.peakHour) {
    chapters.push({
      id: "hora", title: "a tua hora",
      headline: `O teu ano tocou mais ${atHour(facts.peakHour.hour)}.`,
      mark: hourWords(facts.peakHour.hour),
      narrative: `${count(facts.peakHour.plays)} audições começaram nessa hora. É quando tu mais aperta o play.`,
      proof: { kind: "hour", hour: facts.peakHour.hour, plays: facts.peakHour.plays, hours: facts.hours ?? [] },
    });
  }
  if (facts.fullestMonth) {
    chapters.push({
      id: "mes", title: "o mês mais cheio",
      headline: `${MONTHS[facts.fullestMonth.month - 1].replace(/^./, (letter) => letter.toUpperCase())} foi o mês que mais tocou.`,
      mark: MONTHS[facts.fullestMonth.month - 1],
      narrative: `${count(facts.fullestMonth.plays)} audições num mês só.`,
      proof: facts.monthPlays?.length === 12
        ? { kind: "months", month: facts.fullestMonth.month, value: facts.fullestMonth.plays, plays: facts.monthPlays }
        : { kind: "number", value: facts.fullestMonth.plays, label: `audições em ${MONTHS[facts.fullestMonth.month - 1]}` },
      month: facts.fullestMonth.month,
    });
  }
  // a corrida: o gênero que mais subiu na classificação do ano
  const climb = facts.race && facts.race.months.length >= 3 ? biggestClimbOf(facts.race.lanes) : null;
  if (climb && facts.race) {
    const label = genreLabel(climb.genre);
    chapters.push({
      id: "corrida", title: "a corrida dos gêneros",
      headline: `${label.charAt(0).toUpperCase()}${label.slice(1)} foi do ${climb.from}º ao ${climb.to}º lugar.`,
      mark: `${label.charAt(0).toUpperCase()}${label.slice(1)}`,
      narrative: `De ${monthName(facts.race.months[0])} pra cá, nenhum gênero subiu tanto na tua classificação: ${climb.from - climb.to} ${climb.from - climb.to === 1 ? "posição" : "posições"}.`,
      proof: { kind: "race", genre: climb.genre, from: climb.from, to: climb.to, months: facts.race.months, lanes: facts.race.lanes },
    });
  }
  if (facts.topAlbum) {
    const every = facts.throughMonth > 1 && facts.topAlbum.months >= facts.throughMonth;
    const album = cleanTitle(facts.topAlbum.name);
    chapters.push({
      id: "disco", title: "o disco do ano",
      headline: `O disco do ano foi ${album}.`,
      mark: album,
      narrative: every
        ? `Apareceu em todos os meses. ${count(facts.topAlbum.plays)} faixas dele tocaram.`
        : `Apareceu em ${facts.topAlbum.months} ${facts.topAlbum.months === 1 ? "mês" : "meses"} diferentes e somou ${count(facts.topAlbum.plays)} faixas.`,
      proof: { kind: "cover", title: facts.topAlbum.name, artist: facts.topAlbum.artist, coverUrl: facts.topAlbum.coverUrl,
        tally: facts.topAlbum.months, tallyLabel: facts.topAlbum.months === 1 ? "1 mês" : `${facts.topAlbum.months} meses` },
    });
  }
  return chapters;
}
