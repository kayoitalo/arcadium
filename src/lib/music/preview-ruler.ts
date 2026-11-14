/*
 * A régua da prévia: o trecho que toca, medido como cota de desenho
 * técnico. Marcas de 5 em 5 segundos, maiores a cada 15. Só conta.
 */

export interface RulerMark {
  /** Posição na régua, de 0 a 1. */
  at: number;
  seconds: number;
  major: boolean;
}

/** As marcas de uma régua do tamanho da prévia. Sem duração conhecida, sem marcas. */
export function rulerMarks(duration: number, step = 5, majorEvery = 15): RulerMark[] {
  if (!Number.isFinite(duration) || duration <= 0) return [];
  const marks: RulerMark[] = [];
  for (let seconds = 0; seconds <= duration + 0.25; seconds += step) {
    marks.push({ at: Math.min(1, seconds / duration), seconds, major: seconds % majorEvery === 0 });
  }
  return marks;
}

/** "0:12": o tempo do jeito que um tocador mostra. */
export function clock(seconds: number): string {
  const whole = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Quanto da prévia já tocou, de 0 a 1. */
export function progressOf(time: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(time)) return 0;
  return Math.min(1, Math.max(0, time / duration));
}
