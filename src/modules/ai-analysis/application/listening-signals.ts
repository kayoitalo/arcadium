import { NARRATIVE_FORMS, type MusicProfileInput, type NarrativeAngle, type NarrativeForm } from "../domain/ai-analysis.types";

/**
 * Sinais que dão ao Gemini do que falar além do ranking. Tudo aqui é
 * calculado de dados reais do período — o modelo só reage, nunca inventa.
 */

export interface OutlierArtist {
  name: string;
  plays: number;
  genre: string;
}

export interface ComebackArtist {
  name: string;
  plays: number;
  /** Quanto tempo ficou sem tocar, já em palavras: "9 meses", "mais de 2 anos". */
  awayFor: string;
}

/**
 * O intervalo em linguagem de gente. Dias crus ("1151 dias") viram frase
 * esquisita no texto, e a precisão não acrescenta nada à história.
 */
export function describeGap(days: number): string {
  if (days < 365) return `${Math.max(3, Math.floor(days / 30))} meses`;
  const years = Math.floor(days / 365);
  return years === 1 ? "mais de um ano" : `mais de ${years} anos`;
}

export interface LoopedTrack {
  artist: string;
  track: string;
  times: number;
}

const genreTokens = (genre: string) =>
  genre
    .toLowerCase()
    .split(/[\s/&-]+/)
    .filter((token) => token.length > 1);

/**
 * O ponto fora da curva: um artista cujo gênero não divide nenhuma palavra
 * com os gêneros que dominam o período ("forró" no meio de "punk rock" e
 * "french house"). Quem já está no topo não conta — surpresa é o que
 * aparece de lado, não quem manda.
 */
export function findOutliers(
  artists: Array<{ name: string; plays: number; genres: string[] }>,
  dominantGenres: string[],
  { exclude = new Set<string>(), minPlays = 2, limit = 3 }: { exclude?: Set<string>; minPlays?: number; limit?: number } = {},
): OutlierArtist[] {
  if (dominantGenres.length === 0) return [];
  const dominant = new Set(dominantGenres.flatMap(genreTokens));

  return artists
    .filter((artist) => artist.plays >= minPlays && artist.genres.length > 0 && !exclude.has(artist.name))
    .filter((artist) => artist.genres.every((genre) => genreTokens(genre).every((token) => !dominant.has(token))))
    .sort((a, b) => b.plays - a.plays)
    .slice(0, limit)
    .map((artist) => ({ name: artist.name, plays: artist.plays, genre: artist.genres[0] }));
}

/**
 * A faixa em loop: a maior sequência da mesma música tocando uma atrás da
 * outra. Recebe as audições em ordem cronológica. Abaixo de `minTimes`
 * seguidas é só uma música de que a pessoa gosta, não um loop.
 */
export function longestLoop(
  events: Array<{ artist?: string | null; track?: string | null }>,
  minTimes = 4,
): LoopedTrack | null {
  let best: LoopedTrack | null = null;
  let previous = "";
  let run = 0;

  for (const event of events) {
    if (!event.artist || !event.track) {
      previous = "";
      run = 0;
      continue;
    }
    const key = JSON.stringify([event.artist, event.track]);
    run = key === previous ? run + 1 : 1;
    previous = key;
    if (run >= minTimes && (!best || run > best.times)) {
      best = { artist: event.artist, track: event.track, times: run };
    }
  }

  return best;
}

/**
 * Quem voltou: artistas do período cuja audição anterior mais recente é
 * de pelo menos `minGapDays` antes do início dele. Quem nunca tocou antes
 * é estreia, não volta — fica de fora.
 */
export function findComebacks(
  current: Array<{ name: string; plays: number }>,
  lastSeenBefore: Map<string, Date>,
  periodStart: Date,
  { minGapDays = 90, limit = 3 }: { minGapDays?: number; limit?: number } = {},
): ComebackArtist[] {
  return current
    .flatMap((artist) => {
      const last = lastSeenBefore.get(artist.name);
      if (!last) return [];
      const daysAway = Math.floor((periodStart.getTime() - last.getTime()) / 86_400_000);
      return daysAway >= minGapDays ? [{ name: artist.name, plays: artist.plays, awayFor: describeGap(daysAway) }] : [];
    })
    .sort((a, b) => b.plays - a.plays)
    .slice(0, limit);
}

export interface TransitionSide {
  artist: string;
  track: string;
  genre: string;
}

export interface UnlikelyTransition {
  from: TransitionSide;
  to: TransitionSide;
}

/**
 * A transição improvável: duas audições seguidas de artistas cujos gêneros
 * não dividem nenhuma palavra — o house de 10 minutos e, logo depois, o
 * thrash metal. É o que torna verdade o "de repente…" dos textos. Entre as
 * candidatas, vence a que sai de um artista frequente para um raro: é aí
 * que a quebra surpreende.
 */
export function findUnlikelyTransition(
  events: Array<{ artist?: string | null; track?: string | null }>,
  genresByArtist: Map<string, string[]>,
  playsByArtist: Map<string, number>,
): UnlikelyTransition | null {
  let best: { transition: UnlikelyTransition; score: number } | null = null;

  for (let index = 1; index < events.length; index += 1) {
    const previous = events[index - 1];
    const next = events[index];
    if (!previous.artist || !previous.track || !next.artist || !next.track) continue;
    if (previous.artist === next.artist) continue;

    const fromGenres = genresByArtist.get(previous.artist) ?? [];
    const toGenres = genresByArtist.get(next.artist) ?? [];
    if (fromGenres.length === 0 || toGenres.length === 0) continue;

    const fromTokens = new Set(fromGenres.flatMap(genreTokens));
    if (toGenres.flatMap(genreTokens).some((token) => fromTokens.has(token))) continue;

    const score = (playsByArtist.get(previous.artist) ?? 1) / (playsByArtist.get(next.artist) ?? 1);
    if (!best || score > best.score) {
      best = {
        score,
        transition: {
          from: { artist: previous.artist, track: previous.track, genre: fromGenres[0] },
          to: { artist: next.artist, track: next.track, genre: toGenres[0] },
        },
      };
    }
  }

  return best?.transition ?? null;
}

/** A faixa mais tocada de cada artista: a referência sai do que foi ouvido de fato. */
export function topTrackByArtist(rows: Array<{ artist: string; track: string; plays: number }>): Map<string, string> {
  const best = new Map<string, { track: string; plays: number }>();
  for (const row of rows) {
    const current = best.get(row.artist);
    if (!current || row.plays > current.plays) best.set(row.artist, { track: row.track, plays: row.plays });
  }
  return new Map([...best.entries()].map(([artist, entry]) => [artist, entry.track]));
}

/** Os ângulos que o perfil sustenta: sem dado, o ângulo não entra no sorteio. */
export function availableAngles(profile: MusicProfileInput): NarrativeAngle[] {
  const angles: NarrativeAngle[] = ["numeros"];
  if (profile.outliers?.length) angles.push("surpresa");
  if (profile.transition) angles.push("transicao");
  if (profile.mostPlayed?.track || profile.mostPlayed?.album) angles.push("mais-ouvido");
  if (profile.risingArtists.length > 0) angles.push("mudanca");
  if (profile.eras?.length) angles.push("epoca");
  if (profile.comebacks?.length) angles.push("volta");
  if (profile.loop) angles.push("loop");
  return angles;
}

/**
 * Um ângulo por leitura, sorteado entre os disponíveis e diferente do
 * anterior quando há alternativa — é o que impede toda leitura de ser a
 * mesma piada.
 */
export function pickAngle(
  available: NarrativeAngle[],
  previous: NarrativeAngle | null,
  random: () => number = Math.random,
): NarrativeAngle {
  return pickFresh(available.length > 0 ? available : ["numeros"], previous, random);
}

/**
 * A forma da piada (reação, pergunta, apelido…), sorteada à parte do
 * ângulo e diferente da anterior: sem isso toda leitura vira "tu tava
 * ouvindo X e de repente Y".
 */
export function pickForm(previous: NarrativeForm | null, random: () => number = Math.random): NarrativeForm {
  return pickFresh([...NARRATIVE_FORMS], previous, random);
}

function pickFresh<T>(options: T[], previous: T | null, random: () => number): T {
  const fresh = options.filter((option) => option !== previous);
  const pool = fresh.length > 0 ? fresh : options;
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}
