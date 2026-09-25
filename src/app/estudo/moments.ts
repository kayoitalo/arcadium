import { prisma } from "@/lib/db/prisma";
import { formatGenre } from "@/lib/format/genre";
import { AIAnalysisService } from "@/modules/ai-analysis/application/ai-analysis-service";
import type { PackView, ProfileNarrative } from "@/modules/ai-analysis/domain/ai-analysis.types";
import { ItunesPreviewAdapter } from "@/modules/recommendations/infrastructure/itunes-preview-adapter";
import { loadArtistGenres } from "@/modules/statistics/application/artist-genres";
import { getPeriodRanges, type PeriodKey } from "@/modules/statistics/application/overview-service";

/*
 * Os momentos do estudo: uma leitura de verdade do pacote e, junto, a
 * prova que ela cita. A prova não vem do perfil de agora, e sim do texto:
 * se a frase fala de "The Emptiness Machine" e "Can't Hold Us", a prova é
 * aquele par de audições, e não outra transição qualquer do período.
 */

export interface StudyCover {
  url: string | null;
  title: string;
  artist: string;
}

export interface StudySide {
  artist: string;
  track: string;
  genre: string | null;
  cover: StudyCover;
  previewUrl: string | null;
  /** "31 ago · 21:19", no fuso de quem ouviu. */
  when: string;
}

export interface StudyRow {
  label: string;
  sub: string;
  plays: number;
}

/** Uma audição vizinha da transição: o que tocou antes e depois do salto. */
export interface StudyStep {
  artist: string;
  track: string;
  when: string;
}

export type StudyEvidence =
  | {
      kind: "transition";
      from: StudySide;
      to: StudySide;
      /** Minutos entre o início de uma e o da outra. */
      gapMinutes: number;
      /** Duas audições antes e duas depois: o salto dentro da sequência de verdade. */
      context: { before: StudyStep[]; after: StudyStep[] };
    }
  | {
      kind: "mostPlayed";
      focus: "track" | "album";
      rows: StudyRow[];
      /** A linha que a frase cita — é nela que o amigo faz o círculo. */
      focusIndex: number;
      cover: StudyCover;
      previewUrl: string | null;
      previewTrack: string | null;
    };

export interface StudyMoment {
  key: string;
  /** A janela, dita pelo amigo: "nesse último mês", "desde que eu te conheço". */
  window: string;
  headline: string;
  narrative: string;
  insight: string;
  closing: string | null;
  evidence: StudyEvidence;
}

type EvidenceKind = StudyEvidence["kind"];

/**
 * O roteiro: o amigo escolhe o que contar, de qualquer janela. Cada vaga
 * pede um tipo de prova e diz em que janelas procurar, na ordem; os
 * pacotes se renovam sozinhos, então o roteiro não pode prender um ângulo
 * a um período. Ficam só as leituras cuja prova bate com o banco — as de
 * "voltou depois de 3 anos" nem entram, porque o buraco no histórico
 * inventa essas voltas.
 */
const SCRIPT: Array<{ kind: EvidenceKind; periods: PeriodKey[] }> = [
  { kind: "transition", periods: ["30d", "7d", "1y", "all"] },
  { kind: "mostPlayed", periods: ["30d", "7d", "1y"] },
  { kind: "mostPlayed", periods: ["all", "1y"] },
];

/** Linhas da lista: a v1 mostra as 5 primeiras; na v2, "me mostra mais" abre o resto. */
const ROWS = 10;

const previews = new ItunesPreviewAdapter();

/** Minúsculas, sem acento e sem "(feat. …)": o jeito de achar o nome dentro da frase. */
function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s*[([].*?[)\]]/g, "")
    .replace(/[’`]/g, "'")
    .toLowerCase()
    .trim();
}

/** Nome inteiro dentro da frase: "Element" não pode casar com "elemento". */
function mentions(text: string, name: string | null | undefined): boolean {
  const needle = name ? normalize(name) : "";
  if (needle.length < 3) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(normalize(text));
}

/** Capa do Last.fm vem em 300px; a mesma CDN serve 600, que é o que a tela pede. */
function sharpCover(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace("/i/u/300x300/", "/i/u/600x600/");
}

/** "31 ago · 21:19": a hora em que tocou, que é o que faz a transição ser de verdade. */
function formatWhen(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("day")} ${part("month").replace(".", "")} · ${part("hour")}:${part("minute")}`;
}

async function windowLabel(userId: string, period: PeriodKey): Promise<string> {
  if (period === "7d") return "essa semana";
  if (period === "30d") return "nesse último mês";
  if (period === "1y") return "de um ano pra cá";

  const first = await prisma.listeningEvent.findFirst({
    where: { userId },
    orderBy: { playedAt: "asc" },
    select: { playedAt: true },
  });
  if (!first) return "desde que eu te conheço";
  const month = first.playedAt.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
  return `desde que eu te conheço, lá em ${month}`;
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

async function transitionEvidence(
  userId: string,
  period: PeriodKey,
  reading: ProfileNarrative,
  timeZone: string,
): Promise<StudyEvidence | null> {
  const { current } = getPeriodRanges(period);
  const events = await prisma.listeningEvent.findMany({
    where: period === "all" ? { userId } : { userId, playedAt: { gte: current.start, lte: current.end } },
    orderBy: { playedAt: "asc" },
    select: { rawArtistName: true, rawTrackName: true, playedAt: true, albumId: true, trackId: true },
  });

  // cada lado da transição vale 2 se a frase cita a faixa e 1 se cita só o
  // artista; os dois lados precisam estar na frase, e ganha o par mais citado
  const text = `${reading.headline} ${reading.narrative} ${reading.insight}`;
  const side = (event: (typeof events)[number]) =>
    mentions(text, event.rawTrackName) ? 2 : mentions(text, event.rawArtistName) ? 1 : 0;
  let pair: [(typeof events)[number], (typeof events)[number]] | null = null;
  let at = -1;
  let best = 0;
  for (let index = events.length - 1; index > 0; index -= 1) {
    const [a, b] = [events[index - 1], events[index]];
    if (a.rawArtistName === b.rawArtistName) continue;
    const [left, right] = [side(a), side(b)];
    if (left > 0 && right > 0 && left + right > best) {
      pair = [a, b];
      at = index - 1;
      best = left + right;
      if (best === 4) break;
    }
  }
  if (!pair) return null;

  const step = (event: (typeof events)[number]): StudyStep => ({
    artist: event.rawArtistName,
    track: event.rawTrackName,
    when: formatWhen(event.playedAt, timeZone),
  });
  const context = {
    before: events.slice(Math.max(0, at - 2), at).map(step),
    after: events.slice(at + 2, at + 4).map(step),
  };
  const gapMinutes = Math.max(0, Math.round((pair[1].playedAt.getTime() - pair[0].playedAt.getTime()) / 60_000));

  const genres = await loadArtistGenres(pair.map((event) => event.rawArtistName));
  const [from, to] = await Promise.all(
    pair.map(async (event): Promise<StudySide> => {
      const [cover, preview] = await Promise.all([
        coverOf(event.albumId),
        previewFor(event.trackId, event.rawArtistName, event.rawTrackName),
      ]);
      const genre = genres.get(event.rawArtistName)?.[0];
      return {
        artist: event.rawArtistName,
        track: event.rawTrackName,
        genre: genre ? formatGenre(genre) : null,
        cover: {
          url: cover.url ?? preview.artworkUrl,
          title: cover.title ?? event.rawTrackName,
          artist: event.rawArtistName,
        },
        previewUrl: preview.url,
        when: formatWhen(event.playedAt, timeZone),
      };
    }),
  );

  return { kind: "transition", from, to, gapMinutes, context };
}

async function mostPlayedEvidence(
  userId: string,
  period: PeriodKey,
  reading: ProfileNarrative,
): Promise<StudyEvidence | null> {
  const { current } = getPeriodRanges(period);
  const where = period === "all" ? { userId } : { userId, playedAt: { gte: current.start, lte: current.end } };

  const [tracks, albums] = await Promise.all([
    prisma.listeningEvent.groupBy({
      by: ["rawArtistName", "rawTrackName"],
      where,
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: ROWS,
    }),
    prisma.listeningEvent.groupBy({
      by: ["rawArtistName", "rawAlbumName"],
      where: { ...where, NOT: { rawAlbumName: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: ROWS,
    }),
  ]);

  // a frase manda: manchete antes da narrativa, narrativa antes do detalhe
  const fields = [reading.headline, reading.narrative, reading.insight];
  let focus: "track" | "album" | null = null;
  let focusIndex = -1;
  for (const field of fields) {
    const trackHit = tracks.findIndex((row) => mentions(field, row.rawTrackName));
    const albumHit = albums.findIndex((row) => mentions(field, row.rawAlbumName));
    if (albumHit >= 0) [focus, focusIndex] = ["album", albumHit];
    else if (trackHit >= 0) [focus, focusIndex] = ["track", trackHit];
    if (focus) break;
  }
  if (!focus) return null;

  const rows: StudyRow[] =
    focus === "track"
      ? tracks.map((row) => ({ label: row.rawTrackName, sub: row.rawArtistName, plays: row._count.id }))
      : albums.map((row) => ({ label: row.rawAlbumName ?? "", sub: row.rawArtistName, plays: row._count.id }));

  const chosen = rows[focusIndex];
  const sample = await prisma.listeningEvent.findFirst({
    where:
      focus === "track"
        ? { ...where, rawArtistName: chosen.sub, rawTrackName: chosen.label }
        : { ...where, rawArtistName: chosen.sub, rawAlbumName: chosen.label },
    orderBy: { playedAt: "desc" },
    select: { albumId: true },
  });

  // disco sem faixa escolhida toca a que mais rodou dele no período
  const previewTrack =
    focus === "track"
      ? { rawTrackName: chosen.label }
      : (
          await prisma.listeningEvent.groupBy({
            by: ["rawTrackName"],
            where: { ...where, rawArtistName: chosen.sub, rawAlbumName: chosen.label },
            _count: { id: true },
            orderBy: { _count: { id: "desc" } },
            take: 1,
          })
        )[0];
  const trackEvent = previewTrack
    ? await prisma.listeningEvent.findFirst({
        where: { userId, rawArtistName: chosen.sub, rawTrackName: previewTrack.rawTrackName },
        orderBy: { playedAt: "desc" },
        select: { trackId: true },
      })
    : null;

  const [cover, preview] = await Promise.all([
    coverOf(sample?.albumId ?? null),
    previewTrack
      ? previewFor(trackEvent?.trackId ?? null, chosen.sub, previewTrack.rawTrackName)
      : Promise.resolve({ url: null, artworkUrl: null }),
  ]);

  return {
    kind: "mostPlayed",
    focus,
    rows,
    focusIndex,
    cover: { url: cover.url ?? preview.artworkUrl, title: cover.title ?? chosen.label, artist: chosen.sub },
    previewUrl: preview.url,
    previewTrack: previewTrack?.rawTrackName ?? null,
  };
}

/** A prova do tipo que a vaga pede, se a leitura citar esse tipo de sinal. */
async function evidenceFor(
  kind: EvidenceKind,
  userId: string,
  period: PeriodKey,
  reading: ProfileNarrative,
  timeZone: string,
) {
  const cited = reading.referencedEvidence ?? [];
  if (kind === "transition" && cited.includes("transition")) return transitionEvidence(userId, period, reading, timeZone);
  if (kind === "mostPlayed" && cited.includes("mostPlayed")) return mostPlayedEvidence(userId, period, reading);
  return null;
}

export async function loadStudyMoments(): Promise<StudyMoment[]> {
  const user = await prisma.user.findFirst({ select: { id: true, timezone: true } });
  if (!user) return [];

  // sem `schedule`: o estudo lê o pacote que existe e nunca pede um novo em
  // segundo plano — renovar gasta a cota diária do Gemini
  const service = new AIAnalysisService();
  const packs = new Map<PeriodKey, Promise<PackView>>();
  const packOf = (period: PeriodKey) => {
    if (!packs.has(period)) packs.set(period, service.getPack(user.id, period));
    return packs.get(period)!;
  };

  const moments: StudyMoment[] = [];
  const used = new Set<string>();
  for (const slot of SCRIPT) {
    search: for (const period of slot.periods) {
      const pack = await packOf(period);
      if (pack.source !== "ai") continue;
      for (const reading of pack.readings) {
        const key = `${period}:${reading.headline}`;
        if (used.has(key)) continue;
        const evidence = await evidenceFor(slot.kind, user.id, period, reading, user.timezone);
        if (!evidence) continue;
        used.add(key);
        moments.push({
          key,
          window: await windowLabel(user.id, period),
          headline: reading.headline,
          narrative: reading.narrative,
          insight: reading.insight,
          closing: reading.playfulClosing ?? null,
          evidence,
        });
        break search;
      }
    }
  }

  return moments;
}
