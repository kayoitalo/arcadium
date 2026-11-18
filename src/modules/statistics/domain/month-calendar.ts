/*
 * O mês em capas, na parte que é só conta: dia de calendário no fuso de
 * quem ouve, a grade do mês e o dia mais cheio. Sem banco: serve à tela
 * e ao servidor.
 */

export interface MonthDay {
  /** "2026-11-07", no fuso do usuário. */
  day: string;
  plays: number;
  /** O disco que mais tocou no dia; `null` quando nenhuma audição do dia tem disco. */
  album: string | null;
  artist: string | null;
  coverUrl: string | null;
}

export interface MonthCovers {
  /** "2026-11" */
  month: string;
  /** Hoje, no fuso do usuário: os dias depois dele ainda não aconteceram. */
  today: string;
  timezone: string;
  days: MonthDay[];
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** O dia de calendário de um instante, no fuso pedido. */
export function localDay(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

/** Quantos minutos o fuso está à frente do UTC naquele instante. */
function offsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(instant);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(read("year"), read("month") - 1, read("day"), read("hour"), read("minute"), read("second"));
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/** O instante em que um dia de calendário começa naquele fuso. */
function startOfLocalDay(year: number, month: number, day: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day);
  const first = new Date(guess - offsetMinutes(new Date(guess), timeZone) * 60_000);
  // perto de uma mudança de horário o primeiro palpite usa o deslocamento errado: confere uma vez
  return new Date(guess - offsetMinutes(first, timeZone) * 60_000);
}

/**
 * Os instantes que delimitam um dia de calendário ("2026-11-07") no fuso
 * de quem ouve. Devolve `null` para um dia que não existe.
 */
export function localDayBounds(day: string, timeZone: string): { start: Date; end: Date } | null {
  if (!DAY.test(day)) return null;
  const [year, month, date] = day.split("-").map(Number);
  const check = new Date(Date.UTC(year, month - 1, date));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== date) return null;
  const next = new Date(Date.UTC(year, month - 1, date + 1));
  try {
    return {
      start: startOfLocalDay(year, month, date, timeZone),
      end: startOfLocalDay(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timeZone),
    };
  } catch {
    // fuso que o runtime não conhece: sem recorte por dia, em vez de erro
    return null;
  }
}

export interface MonthCell {
  /** `null` é o vão antes do dia 1, para o mês começar no dia certo da semana. */
  day: string | null;
  number: number | null;
  future: boolean;
  entry: MonthDay | null;
}

/** O mês como grade de calendário, de domingo a sábado, com os dias que tocaram no lugar. */
export function monthGrid(month: string, today: string, days: MonthDay[]): MonthCell[] {
  const [year, index] = month.split("-").map(Number);
  const lead = new Date(Date.UTC(year, index - 1, 1)).getUTCDay();
  const length = new Date(Date.UTC(year, index, 0)).getUTCDate();
  const byDay = new Map(days.map((entry) => [entry.day, entry]));
  const cells: MonthCell[] = Array.from({ length: lead }, () => ({ day: null, number: null, future: false, entry: null }));
  for (let number = 1; number <= length; number += 1) {
    const day = `${month}-${String(number).padStart(2, "0")}`;
    cells.push({ day, number, future: day > today, entry: byDay.get(day) ?? null });
  }
  return cells;
}

/** O dia mais cheio do mês; no empate, o mais recente. */
export function fullestDay(days: MonthDay[]): MonthDay | null {
  return days.reduce<MonthDay | null>((best, entry) => (!best || entry.plays >= best.plays ? entry : best), null);
}
