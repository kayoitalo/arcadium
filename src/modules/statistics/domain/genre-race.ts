/*
 * A pista dos gêneros: em que posição cada gênero terminou cada mês, pela
 * fatia da escuta com gênero conhecido. Só conta e ordena. A mesma divisão
 * da evolução: um artista com três gêneros reparte as audições entre os três.
 */

export interface RaceLane {
  genre: string;
  /** A posição em cada mês, 1 é o primeiro; `null` quando o gênero ficou fora da pista naquele mês. */
  places: Array<number | null>;
  /** A fatia de cada mês, em %. */
  shares: number[];
}

export interface GenreRace {
  /** "2026-06", …, do mais antigo para o atual. */
  months: string[];
  lanes: RaceLane[];
}

/** Quantas raias a pista tem: mais que isso vira emaranhado. */
export const RACE_LANES = 8;

/** Os gêneros de cada mês, a partir das audições por artista. */
export function monthShares(
  rows: Array<{ month: string; artist: string; plays: number }>,
  genresOf: (artist: string) => string[],
): Map<string, Map<string, number>> {
  const months = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const tags = genresOf(row.artist).map((tag) => tag.trim().toLowerCase()).filter(Boolean);
    if (tags.length === 0) continue;
    const totals = months.get(row.month) ?? new Map<string, number>();
    for (const tag of tags) totals.set(tag, (totals.get(tag) ?? 0) + row.plays / tags.length);
    months.set(row.month, totals);
  }
  return months;
}

/**
 * A pista: os gêneros que estiveram entre os primeiros em algum mês e
 * ainda estão no último, ou que o último mês mais ouviu. Cada um com a
 * posição de cada mês. Mês sem gênero conhecido não entra na corrida.
 */
export function buildRace(monthsInOrder: string[], shares: Map<string, Map<string, number>>, lanes = RACE_LANES): GenreRace {
  const months = monthsInOrder.filter((month) => shares.has(month));
  if (months.length < 2) return { months, lanes: [] };
  const rankings = months.map((month) => {
    const totals = shares.get(month)!;
    const sum = [...totals.values()].reduce((total, value) => total + value, 0);
    const ordered = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    return { order: ordered.map(([genre]) => genre), share: new Map(ordered.map(([genre, value]) => [genre, (value / sum) * 100])) };
  });
  const latest = rankings[rankings.length - 1];
  // quem está na pista: os do último mês primeiro, depois quem já esteve no pelotão da frente
  const chosen: string[] = [];
  for (const genre of latest.order.slice(0, lanes)) chosen.push(genre);
  const weight = (genre: string) => rankings.reduce((total, ranking) => total + (ranking.share.get(genre) ?? 0), 0);
  for (const genre of [...new Set(rankings.flatMap((ranking) => ranking.order.slice(0, 3)))].sort((a, b) => weight(b) - weight(a))) {
    if (chosen.length >= lanes + 2) break;
    if (!chosen.includes(genre)) chosen.push(genre);
  }
  const kept = chosen.sort((a, b) => weight(b) - weight(a)).slice(0, lanes);
  return {
    months,
    lanes: kept.map((genre) => ({
      genre,
      // a posição é dentro da pista: quem está fora dela não empurra ninguém
      places: rankings.map((ranking) => {
        const inside = ranking.order.filter((name) => kept.includes(name));
        const at = inside.indexOf(genre);
        return at < 0 ? null : at + 1;
      }),
      shares: rankings.map((ranking) => Number((ranking.share.get(genre) ?? 0).toFixed(1))),
    })),
  };
}

/** Quem mais subiu de posição do primeiro ao último mês em que correu; no empate, quem terminou na frente. */
export function biggestClimb(race: GenreRace): { lane: RaceLane; from: number; to: number } | null {
  let best: { lane: RaceLane; from: number; to: number } | null = null;
  for (const lane of race.lanes) {
    const placed = lane.places.filter((place): place is number => place !== null);
    if (placed.length < 2) continue;
    const [from, to] = [placed[0], placed[placed.length - 1]];
    if (to >= from) continue;
    if (!best || from - to > best.from - best.to || (from - to === best.from - best.to && to < best.to)) best = { lane, from, to };
  }
  return best;
}

/** Os N meses até o atual, como "2026-11", a partir do mês corrente. */
export function lastMonths(current: string, count: number): string[] {
  const [year, month] = current.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (count - 1 - index), 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}
