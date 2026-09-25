import { prisma } from "@/lib/db/prisma";
import { formatGenre } from "@/lib/format/genre";
import { AIAnalysisService } from "@/modules/ai-analysis/application/ai-analysis-service";
import type { ProfileNarrative } from "@/modules/ai-analysis/domain/ai-analysis.types";
import { ItunesPreviewAdapter } from "@/modules/recommendations/infrastructure/itunes-preview-adapter";
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
  countsAgree,
  decadesIn,
  focusIn,
  formatWhen,
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
 * - "N vezes" que não bate com o número da prova.
 */

const PERIODS: PeriodKey[] = ["7d", "30d", "1y", "all"];
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

interface Candidate {
  period: PeriodKey;
  kind: EvidenceKind;
  reading: ProfileNarrative;
  evidence: Evidence;
}

/** Tudo que uma visita consulta sobre um período fica aqui, para não repetir consulta. */
class PeriodData {
  private events?: Promise<Array<{ artist: string; track: string; playedAt: Date; albumId: string | null; trackId: string | null }>>;
  private tops = new Map<string, Promise<RankRow[]>>();

  constructor(
    readonly userId: string,
    readonly period: PeriodKey,
  ) {}

  get where() {
    const { current } = getPeriodRanges(this.period);
    return this.period === "all"
      ? { userId: this.userId }
      : { userId: this.userId, playedAt: { gte: current.start, lte: current.end } };
  }

  get start(): Date {
    return getPeriodRanges(this.period).current.start;
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

  async total(): Promise<number> {
    return prisma.listeningEvent.count({ where: this.where });
  }

  async artistPlays(artist: string): Promise<number> {
    return prisma.listeningEvent.count({ where: { ...this.where, rawArtistName: artist } });
  }
}

/** A prévia guardada no catálogo; sem ela, a busca na Apple — que também serve de reserva de capa. */
async function previewFor(trackId: string | null, artist: string, track: string) {
  const stored = trackId
    ? await prisma.track.findUnique({ where: { id: trackId }, select: { previewUrl: true } })
    : null;
  if (stored?.previewUrl) return { url: stored.previewUrl, artworkUrl: null as string | null };
  const found = await previews.findPreview(artist, track);
  return { url: found?.url ?? null, artworkUrl: found?.artworkUrl ?? null };
}

async function coverOf(albumId: string | null): Promise<{ url: string | null; title: string | null }> {
  if (!albumId) return { url: null, title: null };
  const album = await prisma.album.findUnique({ where: { id: albumId }, select: { coverUrl: true, name: true } });
  return { url: sharpCover(album?.coverUrl), title: album?.name ?? null };
}

async function transitionEvidence(data: PeriodData, reading: ProfileNarrative, timeZone: string): Promise<Evidence | null> {
  const events = await data.orderedEvents();
  const at = pickTransition(events, textOf(reading));
  if (at < 0) return null;
  const pair = [events[at], events[at + 1]];

  const genres = await loadArtistGenres(pair.map((event) => event.artist));
  const [from, to] = await Promise.all(
    pair.map(async (event): Promise<TransitionSide> => {
      const [cover, preview] = await Promise.all([
        coverOf(event.albumId),
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
    gapMinutes: Math.max(0, Math.round((pair[1].playedAt.getTime() - pair[0].playedAt.getTime()) / 60_000)),
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

  // todo "N vezes" da frase precisa bater com algum número de verdade
  const truths = [chosen.plays, await data.artistPlays(artist), await data.total()];
  if (!countsAgree(claimedCounts(textOf(reading)), truths)) return null;

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
    coverOf(albumRow?.albumId ?? null),
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
  const artists = (await data.top("artist")).map((row) => row.label).filter((artist) => mentions(text, artist));
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
};

async function evidenceFor(data: PeriodData, reading: ProfileNarrative, timeZone: string): Promise<Candidate | null> {
  const resolvers: Record<EvidenceKind, () => Promise<Evidence | null>> = {
    transition: () => transitionEvidence(data, reading, timeZone),
    ranking: () => rankingEvidence(data, reading),
    decades: () => decadesEvidence(data, reading),
  };
  // a prova segue o que a leitura cita primeiro: uma leitura de época que
  // também cita o topo é sobre a época, não sobre o topo
  const kinds = [
    ...new Set((reading.referencedEvidence ?? []).map((signal) => KIND_OF_SIGNAL[signal]).filter(Boolean)),
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
  async load(userId: string): Promise<{ view: ConversationView; refresh: PeriodKey | null }> {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const timeZone = user?.timezone ?? "America/Sao_Paulo";
    const first = await prisma.listeningEvent.findFirst({
      where: { userId },
      orderBy: { playedAt: "asc" },
      select: { playedAt: true },
    });
    if (!first) return { view: { moments: [], writing: false, hasHistory: false }, refresh: null };

    const packs = await Promise.all(PERIODS.map(async (period) => ({ period, pack: await this.ai.peekPack(userId, period) })));
    const refresh = packs.find(({ pack }) => !pack || pack.stale)?.period ?? null;
    const stamp = packs.map(({ pack }) => pack?.view.builtAt ?? "-").join("|");
    const cacheKey = `${userId}:${stamp}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_MS) return { view: cached.value, refresh };

    let monthlyCache: Promise<Map<string, number>> | null = null;
    const monthly = () => (monthlyCache ??= monthlyPlays(userId));

    const candidates: Candidate[] = [];
    for (const { period, pack } of packs) {
      if (!pack || pack.view.source !== "ai") continue;
      const data = new PeriodData(userId, period);
      for (const reading of pack.view.readings) {
        if (!(await comebacksHold(data, reading, monthly))) continue;
        const candidate = await evidenceFor(data, reading, timeZone);
        if (candidate) candidates.push(candidate);
      }
    }

    const moments: ConversationMoment[] = selectMoments(candidates).map(({ period, reading, evidence }) => ({
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
    return { view, refresh };
  }
}
