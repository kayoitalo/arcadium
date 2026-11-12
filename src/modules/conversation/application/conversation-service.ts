import { prisma } from "@/lib/db/prisma";
import { previewPath } from "@/lib/music/preview-path";
import { formatGenre } from "@/lib/format/genre";
import { AIAnalysisService } from "@/modules/ai-analysis/application/ai-analysis-service";
import { describeGap, findOutliers } from "@/modules/ai-analysis/application/listening-signals";
import type { ProfileNarrative } from "@/modules/ai-analysis/domain/ai-analysis.types";
import { ItunesPreviewAdapter } from "@/modules/recommendations/infrastructure/itunes-preview-adapter";
import { fallbackCover } from "./cover-fallback";
import { loadArtistGenres } from "@/modules/statistics/application/artist-genres";
import { decadeDistribution } from "@/modules/statistics/application/decades";
import { getPeriodRanges, type PeriodKey } from "@/modules/statistics/application/overview-service";
import type {
  ConversationCover,
  ConversationMoment,
  ConversationView,
  Evidence,
  EvidenceKind,
  ListeningStep,
  RankRow,
  TransitionSide,
} from "../domain/conversation.types";
import {
  claimedCounts,
  claimedShares,
  claimsAgree,
  decadesIn,
  focusIn,
  formatDay,
  formatWhen,
  loopRun,
  mentions,
  observedGap,
  pickTransition,
  selectMoments,
  windowLabel,
} from "../domain/matching";

/*
 * A conversa da tela inicial. Lê as leituras já escritas de cada janela
 * (nunca gera nada aqui) e, para cada uma, procura no banco a prova que
 * ela cita. O que não se prova não entra:
 * - frase sem prova achável;
 * - "voltou depois de X" que atravessa um buraco no histórico, ou de
 *   quem nunca tinha tocado antes;
 * - "N vezes" ou "N%" que não bate com o número da prova.
 *
 * A prova é medida na janela que a leitura viu (até o pacote ser escrito):
 * o número da frase e o da tela são o mesmo número.
 */

/**
 * A conversa da tela inicial só fala do que muda: a semana e o mês. O que
 * quase não muda (o ano, tudo) é escrito uma vez por mês e mora no retrato —
 * na tela inicial, repetia o mesmo assunto por semanas.
 */
export type ConversationScope = "recent" | "lasting";
const PERIODS: Record<ConversationScope, PeriodKey[]> = { recent: ["7d", "30d"], lasting: ["1y", "all"] };
/** Assuntos por janela: com duas janelas em cada conversa, três de cada dão os seis do fio. */
const PER_PERIOD = 3;
/** Os mesmos limites de quem escreve (profile-builder): a prova mede o que a leitura viu. */
const COMEBACK_GAP_DAYS = 90;
const DOMINANT_GENRES = 5;
const TOP_ARTISTS = 10;
/** Linhas de lista na prova; a tela mostra 5 e "me mostra mais" abre o resto. */
const ROWS = 10;
/** Abaixo disso o retrato das décadas é parcial demais para ser prova. */
const MIN_DECADE_COVERAGE = 20;
/** A mesma conversa serve visitas seguidas; o pacote muda de hora em hora. */
const CACHE_MS = 10 * 60 * 1000;

const previews = new ItunesPreviewAdapter();
const cache = new Map<string, { at: number; value: ConversationView }>();

/** Capa do Last.fm vem em 300px; a mesma CDN serve 600, que é o que a tela pede. */
function sharpCover(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace("/i/u/300x300/", "/i/u/600x600/");
}

const fieldsOf = (reading: ProfileNarrative) => [reading.headline, reading.narrative, reading.insight];
const textOf = (reading: ProfileNarrative) => fieldsOf(reading).join(" ");
const minuteOf = (date: Date) => Math.floor(date.getTime() / 60_000);
const percent = (part: number, whole: number) => (whole > 0 ? Number(((part / whole) * 100).toFixed(1)) : 0);

interface Candidate {
  period: PeriodKey;
  kind: EvidenceKind;
  reading: ProfileNarrative;
  evidence: Evidence;
}

/**
 * Tudo que uma visita consulta sobre um período fica aqui, para não repetir
 * consulta. A janela é a que a leitura viu: termina quando o pacote foi
 * escrito, não agora. Senão o "41%" dele vira "39,2%" na prova só porque a
 * semana andou.
 */
class PeriodData {
  private events?: Promise<Array<{ artist: string; track: string; playedAt: Date; albumId: string | null; trackId: string | null }>>;
  private tops = new Map<string, Promise<RankRow[]>>();
  private everyone?: Promise<Array<{ name: string; plays: number }>>;

  constructor(
    readonly userId: string,
    readonly period: PeriodKey,
    readonly asOf: Date,
  ) {}

  get where() {
    const { current } = getPeriodRanges(this.period, this.asOf);
    return this.period === "all"
      ? { userId: this.userId, playedAt: { lte: current.end } }
      : { userId: this.userId, playedAt: { gte: current.start, lte: current.end } };
  }

  get start(): Date {
    return getPeriodRanges(this.period, this.asOf).current.start;
  }

  orderedEvents() {
    this.events ??= prisma.listeningEvent
      .findMany({
        where: this.where,
        orderBy: { playedAt: "asc" },
        select: { rawArtistName: true, rawTrackName: true, playedAt: true, albumId: true, trackId: true },
      })
      .then((rows) =>
        rows.map((row) => ({
          artist: row.rawArtistName,
          track: row.rawTrackName,
          playedAt: row.playedAt,
          albumId: row.albumId,
          trackId: row.trackId,
        })),
      );
    return this.events;
  }

  top(unit: "track" | "album" | "artist"): Promise<RankRow[]> {
    let rows = this.tops.get(unit);
    if (!rows) {
      rows =
        unit === "artist"
          ? prisma.listeningEvent
              .groupBy({ by: ["rawArtistName"], where: this.where, _count: { id: true }, orderBy: { _count: { id: "desc" } }, take: ROWS })
              .then((found) => found.map((row) => ({ label: row.rawArtistName, sub: "", plays: row._count.id })))
          : unit === "track"
            ? prisma.listeningEvent
                .groupBy({
                  by: ["rawArtistName", "rawTrackName"],
                  where: this.where,
                  _count: { id: true },
                  orderBy: { _count: { id: "desc" } },
                  take: ROWS,
                })
                .then((found) => found.map((row) => ({ label: row.rawTrackName, sub: row.rawArtistName, plays: row._count.id })))
            : prisma.listeningEvent
                .groupBy({
                  by: ["rawArtistName", "rawAlbumName"],
                  where: { ...this.where, NOT: { rawAlbumName: null } },
                  _count: { id: true },
                  orderBy: { _count: { id: "desc" } },
                  take: ROWS,
                })
                .then((found) =>
                  found.map((row) => ({ label: row.rawAlbumName ?? "", sub: row.rawArtistName, plays: row._count.id })),
                );
      this.tops.set(unit, rows);
    }
    return rows;
  }

  /** Todos os artistas da janela, do que mais tocou para o que menos: a volta e a surpresa moram fora do topo. */
  artists() {
    this.everyone ??= prisma.listeningEvent
      .groupBy({ by: ["rawArtistName"], where: this.where, _count: { id: true }, orderBy: { _count: { id: "desc" } } })
      .then((rows) => rows.map((row) => ({ name: row.rawArtistName, plays: row._count.id })));
    return this.everyone;
  }

  async total(): Promise<number> {
    return prisma.listeningEvent.count({ where: this.where });
  }

  async artistPlays(artist: string): Promise<number> {
    return prisma.listeningEvent.count({ where: { ...this.where, rawArtistName: artist } });
  }
}

/** Known tracks are revalidated on play; old stored URLs do not prove version. */
async function previewFor(trackId: string | null, artist: string, track: string) {
  if (trackId) return { url: previewPath(trackId), artworkUrl: null as string | null };
  const found = await previews.findPreview(artist, track).catch(() => null);
  return { url: found?.url ?? null, artworkUrl: found?.artworkUrl ?? null };
}

/** A capa salva do disco; sem ela, a reserva do catálogo da Apple, que fica gravada para a próxima visita. */
async function coverOf(albumId: string | null, artist: string, track: string | null): Promise<{ url: string | null; title: string | null }> {
  if (!albumId) return { url: null, title: null };
  const album = await prisma.album.findUnique({ where: { id: albumId }, select: { coverUrl: true, name: true } });
  if (!album) return { url: null, title: null };
  if (album.coverUrl) return { url: sharpCover(album.coverUrl), title: album.name };
  return { url: await fallbackCover(albumId, artist, album.name, track), title: album.name };
}

/** A capa e a prévia de um artista na janela: a faixa citada, ou a que mais tocou dele. */
async function mediaFor(data: PeriodData, artist: string, track: string | null) {
  const scope = { ...data.where, rawArtistName: artist, ...(track ? { rawTrackName: track } : {}) };
  const [albumRow] = await prisma.listeningEvent.groupBy({
    by: ["albumId"],
    where: { ...scope, NOT: { albumId: null } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 1,
  });
  const previewTrack =
    track ??
    (
      await prisma.listeningEvent.groupBy({
        by: ["rawTrackName"],
        where: scope,
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 1,
      })
    )[0]?.rawTrackName ??
    null;
  const trackEvent = previewTrack
    ? await prisma.listeningEvent.findFirst({
        where: { userId: data.userId, rawArtistName: artist, rawTrackName: previewTrack, NOT: { trackId: null } },
        orderBy: { playedAt: "desc" },
        select: { trackId: true },
      })
    : null;
  const [cover, preview] = await Promise.all([
    coverOf(albumRow?.albumId ?? null, artist, previewTrack),
    previewTrack ? previewFor(trackEvent?.trackId ?? null, artist, previewTrack) : Promise.resolve({ url: null, artworkUrl: null }),
  ]);
  const view: ConversationCover = { url: cover.url ?? preview.artworkUrl, title: cover.title ?? previewTrack ?? artist, artist };
  return { cover: view, previewUrl: preview.url, previewTrack };
}

/** A faixa que tocou várias vezes seguidas: a sequência de verdade, com a hora de cada vez. */
async function loopEvidence(data: PeriodData, reading: ProfileNarrative, timeZone: string): Promise<Evidence | null> {
  const events = await data.orderedEvents();
  const run = loopRun(events);
  if (!run) return null;
  const { artist, track } = events[run.start];
  const text = textOf(reading);
  if (!mentions(text, track) && !mentions(text, artist)) return null;

  const trackPlays = events.filter((event) => event.artist === artist && event.track === track).length;
  const artistPlays = events.filter((event) => event.artist === artist).length;
  if (!claimsAgree(claimedCounts(text), [run.times, trackPlays, artistPlays, events.length])) return null;
  if (!claimsAgree(claimedShares(text), [percent(trackPlays, events.length), percent(artistPlays, events.length)])) return null;

  const media = await mediaFor(data, artist, track);
  return {
    kind: "loop",
    artist,
    track,
    times: run.times,
    plays: events.slice(run.start, run.start + run.times).map((event) => formatWhen(event.playedAt, timeZone)),
    cover: media.cover,
    previewUrl: media.previewUrl,
  };
}

/** Quem voltou depois de um sumiço: a última audição antes e a primeira da volta. */
async function comebackEvidence(
  data: PeriodData,
  reading: ProfileNarrative,
  timeZone: string,
  monthly: () => Promise<Map<string, number>>,
): Promise<Evidence | null> {
  // em "tudo" não existe um antes de onde voltar
  if (data.period === "all") return null;
  const text = textOf(reading);
  const cited = (await data.artists()).filter((artist) => mentions(text, artist.name));
  for (const artist of cited) {
    const last = await prisma.listeningEvent.findFirst({
      where: { userId: data.userId, rawArtistName: artist.name, playedAt: { lt: data.start } },
      orderBy: { playedAt: "desc" },
      select: { playedAt: true },
    });
    if (!last) continue;
    const daysAway = Math.floor((data.start.getTime() - last.playedAt.getTime()) / 86_400_000);
    if (daysAway < COMEBACK_GAP_DAYS || !observedGap(await monthly(), last.playedAt, data.start)) continue;
    const first = await prisma.listeningEvent.findFirst({
      where: { ...data.where, rawArtistName: artist.name },
      orderBy: { playedAt: "asc" },
      select: { playedAt: true },
    });
    if (!first) continue;

    const total = await data.total();
    if (!claimsAgree(claimedCounts(text), [artist.plays, total])) return null;
    if (!claimsAgree(claimedShares(text), [percent(artist.plays, total)])) return null;
    const media = await mediaFor(data, artist.name, null);
    return {
      kind: "comeback",
      artist: artist.name,
      awayFor: describeGap(daysAway),
      lastBefore: formatDay(last.playedAt, timeZone),
      firstBack: formatDay(first.playedAt, timeZone),
      plays: artist.plays,
      ...media,
    };
  }
  return null;
}

/** O ponto fora da curva: um artista cujo gênero não conversa com nenhum dos que dominam a janela. */
async function outlierEvidence(data: PeriodData, reading: ProfileNarrative): Promise<Evidence | null> {
  const artists = await data.artists();
  const genres = await loadArtistGenres(artists.map((artist) => artist.name));
  const weight = new Map<string, number>();
  for (const artist of artists) {
    const own = genres.get(artist.name) ?? [];
    for (const genre of own) weight.set(genre, (weight.get(genre) ?? 0) + artist.plays / own.length);
  }
  const ranked = [...weight.entries()].sort((a, b) => b[1] - a[1]);
  const dominant = ranked.slice(0, DOMINANT_GENRES);
  const outliers = findOutliers(
    artists.map((artist) => ({ ...artist, genres: genres.get(artist.name) ?? [] })),
    dominant.map(([genre]) => genre),
    { exclude: new Set(artists.slice(0, TOP_ARTISTS).map((artist) => artist.name)), limit: 50 },
  );
  const text = textOf(reading);
  const chosen = outliers.find((artist) => mentions(text, artist.name));
  if (!chosen) return null;

  const total = await data.total();
  const allWeight = ranked.reduce((sum, [, value]) => sum + value, 0) || 1;
  const shares = dominant.map(([genre, value]) => ({ genre: formatGenre(genre), share: percent(value, allWeight) }));
  if (!claimsAgree(claimedCounts(text), [chosen.plays, total])) return null;
  if (!claimsAgree(claimedShares(text), [percent(chosen.plays, total), ...shares.map((entry) => entry.share)])) return null;
  const media = await mediaFor(data, chosen.name, null);
  return { kind: "outlier", artist: chosen.name, genre: formatGenre(chosen.genre), plays: chosen.plays, dominant: shares, ...media };
}

async function transitionEvidence(data: PeriodData, reading: ProfileNarrative, timeZone: string): Promise<Evidence | null> {
  const events = await data.orderedEvents();
  const at = pickTransition(events, textOf(reading));
  if (at < 0) return null;
  // porcentagem não se prova com um salto entre duas faixas
  if (claimedShares(textOf(reading)).length > 0) return null;
  const pair = [events[at], events[at + 1]];

  const genres = await loadArtistGenres(pair.map((event) => event.artist));
  const [from, to] = await Promise.all(
    pair.map(async (event): Promise<TransitionSide> => {
      const [cover, preview] = await Promise.all([
        coverOf(event.albumId, event.artist, event.track),
        previewFor(event.trackId, event.artist, event.track),
      ]);
      const genre = genres.get(event.artist)?.[0];
      return {
        artist: event.artist,
        track: event.track,
        genre: genre ? formatGenre(genre) : null,
        cover: { url: cover.url ?? preview.artworkUrl, title: cover.title ?? event.track, artist: event.artist },
        previewUrl: preview.url,
        when: formatWhen(event.playedAt, timeZone),
      };
    }),
  );

  const step = (event: (typeof events)[number]): ListeningStep => ({
    artist: event.artist,
    track: event.track,
    when: formatWhen(event.playedAt, timeZone),
  });
  return {
    kind: "transition",
    from,
    to,
    // pelo minuto do relógio, como a tela mostra: de 22:38 para 22:43 são 5 min, não 4 e meio arredondados
    gapMinutes: Math.max(0, minuteOf(pair[1].playedAt) - minuteOf(pair[0].playedAt)),
    context: { before: events.slice(Math.max(0, at - 2), at).map(step), after: events.slice(at + 2, at + 4).map(step) },
  };
}

async function rankingEvidence(data: PeriodData, reading: ProfileNarrative): Promise<Evidence | null> {
  const cited = reading.referencedEvidence ?? [];
  const units: Array<"album" | "track" | "artist"> = [];
  if (cited.includes("mostPlayed")) units.push("album", "track");
  if (cited.some((key) => key === "topArtists" || key === "risingArtists" || key === "topTracks")) units.push("artist");
  if (units.length === 0) return null;

  const lists = await Promise.all(units.map(async (unit) => ({ unit, rows: await data.top(unit) })));
  const focus = focusIn(
    fieldsOf(reading),
    lists.map(({ unit, rows }) => ({ unit, labels: rows.map((row) => row.label) })),
  );
  if (!focus) return null;
  const rows = lists.find((list) => list.unit === focus.unit)!.rows;
  const chosen = rows[focus.index];
  const artist = focus.unit === "artist" ? chosen.label : chosen.sub;

  // todo "N vezes" e todo "N%" da frase precisam bater com algum número de verdade
  const text = textOf(reading);
  const [artistPlays, total] = await Promise.all([data.artistPlays(artist), data.total()]);
  if (!claimsAgree(claimedCounts(text), [chosen.plays, artistPlays, total])) return null;
  const shares = claimedShares(text);
  if (!claimsAgree(shares, [percent(chosen.plays, total), percent(artistPlays, total)])) return null;

  const scope = {
    ...data.where,
    rawArtistName: artist,
    ...(focus.unit === "album" ? { rawAlbumName: chosen.label } : focus.unit === "track" ? { rawTrackName: chosen.label } : {}),
  };
  // a capa: o disco citado, o disco da faixa citada, ou o disco que mais tocou do artista
  const [albumRow] = await prisma.listeningEvent.groupBy({
    by: ["albumId"],
    where: { ...scope, NOT: { albumId: null } },
    _count: { id: true },
    orderBy: { _count: { id: "desc" } },
    take: 1,
  });
  // a prévia: a faixa citada, ou a que mais tocou do disco ou do artista
  const previewTrack =
    focus.unit === "track"
      ? chosen.label
      : (
          await prisma.listeningEvent.groupBy({
            by: ["rawTrackName"],
            where: scope,
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 1,
          })
        )[0]?.rawTrackName ?? null;
  const trackEvent = previewTrack
    ? await prisma.listeningEvent.findFirst({
        where: { userId: data.userId, rawArtistName: artist, rawTrackName: previewTrack, NOT: { trackId: null } },
        orderBy: { playedAt: "desc" },
        select: { trackId: true },
      })
    : null;

  const [cover, preview] = await Promise.all([
    coverOf(albumRow?.albumId ?? null, artist, previewTrack),
    previewTrack ? previewFor(trackEvent?.trackId ?? null, artist, previewTrack) : Promise.resolve({ url: null, artworkUrl: null }),
  ]);

  const coverView: ConversationCover = {
    url: cover.url ?? preview.artworkUrl,
    title: cover.title ?? (focus.unit === "album" ? chosen.label : artist),
    artist,
  };
  return {
    kind: "ranking",
    unit: focus.unit,
    rows,
    focusIndex: focus.index,
    share: percent(chosen.plays, total),
    citesShare: shares.length > 0,
    cover: coverView,
    previewUrl: preview.url,
    previewTrack,
  };
}

async function decadesEvidence(data: PeriodData, reading: ProfileNarrative): Promise<Evidence | null> {
  if (!(reading.referencedEvidence ?? []).includes("eras")) return null;
  const events = await prisma.listeningEvent.findMany({
    where: data.where,
    select: { album: { select: { releaseYear: true } } },
  });
  const distribution = decadeDistribution(events.map((event) => event.album?.releaseYear));
  if (distribution.coverage < MIN_DECADE_COVERAGE || distribution.items.length === 0) return null;

  const available = new Set(distribution.items.map((item) => item.decade));
  let focus = decadesIn(textOf(reading)).filter((decade) => available.has(decade));
  if (focus.length === 0) {
    // a frase fala de época sem nomear a década: as que somam a maior parte
    const sorted = [...distribution.items].sort((a, b) => b.share - a.share);
    let sum = 0;
    focus = [];
    for (const item of sorted) {
      if (sum >= 60 || focus.length >= 2) break;
      focus.push(item.decade);
      sum += item.share;
    }
    focus.sort((a, b) => a - b);
  }
  const focusShare = Number(
    distribution.items
      .filter((item) => focus.includes(item.decade))
      .reduce((sum, item) => sum + item.share, 0)
      .toFixed(1),
  );
  const truths = [focusShare, distribution.coverage, ...distribution.items.map((item) => item.share)];
  if (!claimsAgree(claimedShares(textOf(reading)), truths)) return null;
  return {
    kind: "decades",
    bars: distribution.items.map((item) => ({ decade: item.decade, share: item.share, plays: item.plays })),
    focus,
    focusShare,
    coverage: distribution.coverage,
  };
}

/** Audições por mês ("2023-06" → 728), para saber se a pessoa estava ouvindo algo num intervalo. */
async function monthlyPlays(userId: string): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ month: string; plays: number }>>`
    select to_char(date_trunc('month', "playedAt"), 'YYYY-MM') as month, count(*)::int as plays
    from "ListeningEvent" where "userId" = ${userId} group by 1`;
  return new Map(rows.map((row) => [row.month, row.plays]));
}

/**
 * Leitura que fala de volta só passa se toda volta que ela cita for de
 * verdade: o artista tocou antes do período e a pessoa estava ouvindo
 * música no meio-tempo.
 */
async function comebacksHold(
  data: PeriodData,
  reading: ProfileNarrative,
  monthly: () => Promise<Map<string, number>>,
): Promise<boolean> {
  if (!(reading.referencedEvidence ?? []).includes("comebacks")) return true;
  const text = textOf(reading);
  // todos os artistas da janela: quem volta raramente está entre os dez primeiros
  const artists = (await data.artists()).map((row) => row.name).filter((artist) => mentions(text, artist));
  if (artists.length === 0) return false;
  for (const artist of artists) {
    const last = await prisma.listeningEvent.findFirst({
      where: { userId: data.userId, rawArtistName: artist, playedAt: { lt: data.start } },
      orderBy: { playedAt: "desc" },
      select: { playedAt: true },
    });
    // nunca tinha tocado: não há volta nenhuma para contar
    if (!last) return false;
    if (!observedGap(await monthly(), last.playedAt, data.start)) return false;
  }
  return true;
}

/** Que tipo de prova cada sinal citado pela leitura pede. */
const KIND_OF_SIGNAL: Record<string, EvidenceKind> = {
  transition: "transition",
  eras: "decades",
  mostPlayed: "ranking",
  topArtists: "ranking",
  risingArtists: "ranking",
  topTracks: "ranking",
  loop: "loop",
  comebacks: "comeback",
  outliers: "outlier",
};

/** O ângulo que a leitura recebeu no sorteio diz de que ela trata: a prova dele vem primeiro. */
const KIND_OF_ANGLE: Record<string, EvidenceKind> = {
  loop: "loop",
  volta: "comeback",
  surpresa: "outlier",
  transicao: "transition",
  epoca: "decades",
  "mais-ouvido": "ranking",
  mudanca: "ranking",
  numeros: "ranking",
};

async function evidenceFor(
  data: PeriodData,
  reading: ProfileNarrative,
  timeZone: string,
  monthly: () => Promise<Map<string, number>>,
): Promise<Candidate | null> {
  const resolvers: Record<EvidenceKind, () => Promise<Evidence | null>> = {
    transition: () => transitionEvidence(data, reading, timeZone),
    ranking: () => rankingEvidence(data, reading),
    decades: () => decadesEvidence(data, reading),
    loop: () => loopEvidence(data, reading, timeZone),
    comeback: () => comebackEvidence(data, reading, timeZone, monthly),
    outlier: () => outlierEvidence(data, reading),
  };
  // a prova segue o ângulo da leitura e, depois, o que ela cita, na ordem em
  // que cita: uma leitura de época que também cita o topo é sobre a época
  const kinds = [
    ...new Set(
      [KIND_OF_ANGLE[reading.angle ?? ""], ...(reading.referencedEvidence ?? []).map((signal) => KIND_OF_SIGNAL[signal])].filter(Boolean),
    ),
  ];
  const attempts = kinds.map((kind) => [kind, resolvers[kind]] as const);

  for (const [kind, attempt] of attempts) {
    const evidence = await attempt();
    if (evidence) return { period: data.period, kind, reading, evidence };
  }
  return null;
}

export class ConversationService {
  constructor(private ai = new AIAnalysisService()) {}

  /**
   * A conversa pronta para a tela e, se houver, a janela cuja leitura
   * precisa ser escrita ou renovada — quem chama agenda isso depois da
   * resposta, uma janela por visita, para não gastar a cota de uma vez.
   */
  async load(userId: string, scope: ConversationScope = "recent"): Promise<{ view: ConversationView; refresh: PeriodKey | null }> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const timeZone = user?.timezone ?? "America/Sao_Paulo";
    const first = await prisma.listeningEvent.findFirst({
      where: { userId },
      orderBy: { playedAt: "asc" },
      select: { playedAt: true },
    });
    if (!first) return { view: { moments: [], writing: false, hasHistory: false }, refresh: null };

    const packs = await Promise.all(PERIODS[scope].map(async (period) => ({ period, pack: await this.ai.peekPack(userId, period) })));
    const refresh = packs.find(({ pack }) => !pack || pack.stale)?.period ?? null;
    const stamp = packs.map(({ pack }) => pack?.view.builtAt ?? "-").join("|");
    const cacheKey = `${userId}:${scope}:${stamp}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_MS) return { view: cached.value, refresh };

    let monthlyCache: Promise<Map<string, number>> | null = null;
    const monthly = () => (monthlyCache ??= monthlyPlays(userId));

    const candidates: Candidate[] = [];
    for (const { period, pack } of packs) {
      if (!pack || pack.view.source !== "ai") continue;
      const data = new PeriodData(userId, period, pack.view.builtAt ? new Date(pack.view.builtAt) : new Date());
      for (const reading of pack.view.readings) {
        if (!(await comebacksHold(data, reading, monthly))) continue;
        const candidate = await evidenceFor(data, reading, timeZone, monthly);
        if (candidate) candidates.push(candidate);
      }
    }

    const moments: ConversationMoment[] = selectMoments(candidates, { perPeriod: PER_PERIOD }).map(({ period, reading, evidence }) => ({
      key: `${period}:${reading.headline}`,
      period,
      window: windowLabel(period, first.playedAt, timeZone),
      headline: reading.headline,
      narrative: reading.narrative,
      insight: reading.insight,
      closing: reading.playfulClosing ?? null,
      evidence,
    }));

    const view: ConversationView = {
      moments,
      // nenhuma leitura pronta ainda, e uma sendo pedida agora
      writing: moments.length === 0 && packs.every(({ pack }) => !pack),
      hasHistory: true,
    };
    cache.set(cacheKey, { at: Date.now(), value: view });
    for (const [key, entry] of cache) if (Date.now() - entry.at >= CACHE_MS) cache.delete(key);
    while (cache.size > 64) cache.delete(cache.keys().next().value!);
    return { view, refresh };
  }
}
