export interface DecadeItem {
  /** Primeiro ano da década: 1990, 2000… */
  decade: number;
  plays: number;
  /** Fatia das audições com ano conhecido, em %. */
  share: number;
}

export interface DecadeDistribution {
  items: DecadeItem[];
  /** Quanto das audições tem ano de lançamento conhecido, em %. */
  coverage: number;
}

/**
 * De que décadas vêm os discos que você ouve. Recebe o ano de lançamento
 * de cada audição (null quando o disco não tem ano) e divide as que têm
 * ano por década. A cobertura fica separada: um período com 30% de anos
 * conhecidos não pode se passar por retrato completo.
 */
export function decadeDistribution(years: Array<number | null | undefined>): DecadeDistribution {
  const counts = new Map<number, number>();
  let known = 0;

  for (const year of years) {
    if (!year || year < 1900 || year > 2100) continue;
    const decade = Math.floor(year / 10) * 10;
    counts.set(decade, (counts.get(decade) ?? 0) + 1);
    known++;
  }

  const items = [...counts.entries()]
    .sort(([a], [b]) => a - b)
    .map(([decade, plays]) => ({ decade, plays, share: Number(((plays / known) * 100).toFixed(1)) }));

  return { items, coverage: years.length ? Math.round((known / years.length) * 100) : 0 };
}
