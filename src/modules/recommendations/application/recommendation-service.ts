

import { prisma } from "@/lib/db/prisma";
import { filterGenreTags } from "@/modules/enrichment/domain/genre-tags";
import { scoreAndRank, type UserProfile } from "../domain/scoring";
import { isCollaborationOfKnownArtist, limitPerArtist } from "../domain/candidate-filters";
import type { SimilarArtistProvider } from "../domain/similar-artist-provider.interface";
import { LastFmSimilarArtistProvider } from "../infrastructure/lastfm-similar-adapter";
import type { PreviewProvider, TrackPreview } from "../domain/preview-provider.interface";
import { ItunesPreviewAdapter } from "../infrastructure/itunes-preview-adapter";
import { compatiblePreviewIdentity } from "../domain/preview-identity";
import { DiscoveryConflict, effectiveFeedback, effectiveTrackFeedback, trackFeedbackKey } from "../domain/feedback";
import { SessionMemoryService, type FeedbackOptions } from "./session-memory-service";
import type { TrackCoverProvider } from "@/modules/enrichment/domain/cover-art-provider.interface";
import { LastFmCoverAdapter } from "@/modules/enrichment/infrastructure/lastfm-cover-adapter";
import {
  type RecommendationMode,
  type RecommendationContext,
  type FeedbackType,
  type SessionOperation,
  type DiscoveryDials,
  MODE_DIALS,
  type RawCandidate,
  type ScoredCandidate,
  ALGORITHM_VERSION,
  DEFAULT_SESSION_SIZE,
  RECENT_RECOMMENDATION_COOLDOWN_DAYS,
} from "../domain/recommendation.types";

/** Teto de artistas externos por sessão — cada um custa uma chamada de rede. */
const EXTERNAL_ARTIST_LIMIT = 18;

/** Um artista não pode dominar a sessão: variedade vale mais que profundidade. */
const MAX_TRACKS_PER_ARTIST = 1;

/** Enquanto a sessão é recente, trocar de aba não deve refazer tudo. */
const SESSION_REUSE_WINDOW_MS = 6 * 60 * 60 * 1000;

function toSessionResult(session: {
  id: string;
  mode: string;
  context: string | null;
  algorithmVersion: string;
  currentRank?: number | null;
  profilePeriod?: string;
  items: Array<Record<string, any>>;
}): SessionResult {
  return {
    sessionId: session.id,
    mode: session.mode as RecommendationMode,
    context: session.context,
    algorithmVersion: session.algorithmVersion,
    currentRank: session.currentRank ?? session.items.find((item) => item.status === "PENDING")?.rank ?? session.items.length + 1,
    settings: sessionSettings(session.profilePeriod, session.mode, session.context),
    items: session.items.map((item) => {
      const previewIdentity = compatiblePreviewIdentity((item.scoreComponents as any)?.previewIdentity,
        { artistName: item.artistName, trackName: item.trackName });
      return {
      id: item.id,
      artistName: item.artistName,
      trackName: item.trackName,
      albumName: item.albumName,
      genre: item.genre,
      score: item.score,
      noveltyScore: item.noveltyScore,
      scoreComponents: item.scoreComponents,
      rank: item.rank,
      status: item.status,
      feedback: effectiveFeedback(item.feedback ?? []),
      reason: item.reason,
      coverUrl: item.coverUrl ?? null,
      previewIdentity,
      previewUrl: previewIdentity ? item.previewUrl ?? null : null,
      appleMusicUrl: previewIdentity ? item.appleMusicUrl ?? null : null,
      position: (item.scoreComponents as any)?.position ?? null,
      };
    }),
  };
}

function coverKey(candidate: { artistName: string; trackName: string }): string {
  return `${candidate.artistName.toLowerCase()}|${candidate.trackName.toLowerCase()}`;
}

function sessionSettings(profilePeriod: string | undefined, mode: string, context: string | null) {
  const [period = "30d", proximity, fame] = (profilePeriod ?? "30d").split(":");
  return { period, mode: mode as RecommendationMode, context: (context ?? "GENERAL") as RecommendationContext,
    dials: proximity != null && fame != null ? { proximity: Number(proximity), fame: Number(fame) } : MODE_DIALS[mode as RecommendationMode] };
}

const sessionInclude = (userId: string) => ({ items: { orderBy: { rank: "asc" as const },
  include: { feedback: { where: { userId }, orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] } } } });

export interface GenerateSessionInput {
  userId: string;
  mode: RecommendationMode;
  context?: RecommendationContext;
  period?: string;
  size?: number;
  /** Onde a pessoa deixou os dois controles. Sem isso, usa o preset do modo. */
  dials?: DiscoveryDials;
  operation?: SessionOperation;
  sessionId?: string;
  requestKey?: string;
}

export interface SessionResult {
  sessionId: string;
  mode: RecommendationMode;
  context: string | null;
  algorithmVersion: string;
  currentRank: number;
  settings: ReturnType<typeof sessionSettings>;
  items: Array<{
    id: string;
    artistName: string;
    trackName: string;
    albumName: string | null;
    genre: string | null;
    score: number;
    noveltyScore: number | null;
    scoreComponents: any;
    rank: number;
    status: string;
    feedback: ReturnType<typeof effectiveFeedback>;
    reason: string | null;
    coverUrl: string | null;
    previewUrl: string | null;
    previewIdentity: TrackPreview["identity"] | null;
    appleMusicUrl: string | null;
    position: { proximity: number; fame: number } | null;
  }>;
}

export class RecommendationService {
  constructor(
    private similarArtists: SimilarArtistProvider = new LastFmSimilarArtistProvider(),
    private trackCovers: TrackCoverProvider = new LastFmCoverAdapter(),
    private previews: PreviewProvider = new ItunesPreviewAdapter(),
  ) {}

  async generateSession(input: GenerateSessionInput): Promise<SessionResult> {
    const operation = input.operation ?? "AUTO";
    let effective = input;
    const source = input.sessionId ? await prisma.recommendationSession.findFirst({ where: { id: input.sessionId, userId: input.userId }, include: sessionInclude(input.userId) }) : null;
    if (input.sessionId && !source) throw new DiscoveryConflict("Sessão não encontrada.", 404);
    if (operation === "RESUME") {
      if (source && source.status !== "ACTIVE") throw new DiscoveryConflict("Essa busca ainda não está disponível para retomar.");
      if (source) return (await this.getSession(source.id, input.userId))!;
      const latest = await this.getLatestSession(input.userId);
      if (!latest) throw new DiscoveryConflict("Nenhuma sessão para retomar.", 404);
      return latest;
    }
    if (operation === "MORE") {
      if (!source) throw new DiscoveryConflict("Escolha a sessão para buscar mais.", 400);
      if (source.status !== "ACTIVE") throw new DiscoveryConflict("A sessão original ainda não está pronta.");
      if (source.algorithmVersion !== ALGORITHM_VERSION) throw new DiscoveryConflict("Essa sessão usa o motor anterior. Escolha outra entrada para iniciar uma nova busca.");
      const settings = sessionSettings(source.profilePeriod, source.mode, source.context);
      effective = { ...input, ...settings };
    }
    const { userId, mode, context, period = "30d", size = DEFAULT_SESSION_SIZE } = effective;
    const dials = effective.dials ?? MODE_DIALS[mode];
    const fingerprint = JSON.stringify({ operation, source: input.sessionId ?? null, mode,
      context: context || "GENERAL", period, dials, size, algorithm: ALGORITHM_VERSION });
    const replay = async () => {
      const previous = await prisma.recommendationSession.findUnique({ where: { userId_requestKey: { userId, requestKey: input.requestKey! } } });
      if (!previous || previous.requestFingerprint !== fingerprint) throw new DiscoveryConflict("Chave de busca já utilizada com outros parâmetros.");
      if (previous.status === "GENERATING" && previous.updatedAt.getTime() < Date.now() - 5 * 60_000) {
        await prisma.recommendationSession.updateMany({ where: { id: previous.id, status: "GENERATING", updatedAt: previous.updatedAt }, data: { status: "FAILED" } });
        throw new DiscoveryConflict("A busca anterior foi interrompida. Inicie outra tentativa.", 409, "GENERATION_FAILED");
      }
      if (previous.status !== "ACTIVE") throw new DiscoveryConflict(previous.status === "GENERATING" ? "A busca ainda está em andamento. Tente novamente em alguns instantes." : "A busca falhou. Inicie outra tentativa.", 409, previous.status === "GENERATING" ? "GENERATION_PENDING" : "GENERATION_FAILED");
      return (await this.getSession(previous.id, userId))!;
    };
    if (input.requestKey) {
      const previous = await prisma.recommendationSession.findUnique({ where: { userId_requestKey: { userId, requestKey: input.requestKey } } });
      if (previous) return replay();
    }
    if (operation === "AUTO") {
      const reusable = await prisma.recommendationSession.findFirst({
        where: { userId, mode, context: context || "GENERAL", status: "ACTIVE",
          algorithmVersion: ALGORITHM_VERSION,
          createdAt: { gte: new Date(Date.now() - SESSION_REUSE_WINDOW_MS) },
          profilePeriod: [period, dials.proximity, dials.fame].join(":") },
        orderBy: { createdAt: "desc" }, include: sessionInclude(userId),
      });
      if (reusable?.items.length) return toSessionResult(reusable);
    }
    let reservation;
    try {
      reservation = await prisma.recommendationSession.create({ data: {
        userId, mode, context: context || "GENERAL", profilePeriod: [period, dials.proximity, dials.fame].join(":"),
        algorithmVersion: ALGORITHM_VERSION, status: "GENERATING", currentRank: 1,
        requestKey: input.requestKey, requestFingerprint: fingerprint,
      } });
    } catch (error) {
      if (input.requestKey && (error as { code?: string }).code === "P2002") return replay();
      throw error;
    }
    try {
      const avoid = (source?.items ?? []).filter((item) => item.exposedAt || item.feedback?.length);
      return await this.populateSession({ ...effective, dials }, reservation.id, avoid);
    } catch (error) {
      await prisma.recommendationSession.update({ where: { id: reservation.id }, data: { status: "FAILED" } }).catch(() => undefined);
      throw error;
    }
  }

  private async populateSession(input: GenerateSessionInput, sessionId: string, avoid: Array<{ artistName: string; trackName: string }>): Promise<SessionResult> {
    const { userId, mode, context, period = "30d", size = DEFAULT_SESSION_SIZE } = input;
    const dials = input.dials ?? MODE_DIALS[mode];
    const profile = await this.buildUserProfile(userId, period);

    const rawCandidates = await this.generateCandidates(userId, profile, mode, dials);

    const excluded = new Set(avoid.map(coverKey));
    const filtered = (await this.applyExclusions(userId, rawCandidates, profile)).filter((candidate) => !excluded.has(coverKey(candidate)));

    const scored = scoreAndRank(filtered, profile, mode, dials).slice(0, size);

    const [covers, previews] = await Promise.all([
      this.resolveCovers(scored),
      this.resolvePreviews(scored),
    ]);

    const session = await prisma.recommendationSession.update({
      where: { id: sessionId },
      data: {
        userId,
        mode,
        context: context || "GENERAL",
        profilePeriod: `${period}:${dials.proximity}:${dials.fame}`,
        algorithmVersion: ALGORITHM_VERSION,
        status: "ACTIVE",
        items: {
          create: scored.map((candidate, idx) => ({
            artistName: candidate.artistName,
            trackName: candidate.trackName,
            albumName: candidate.albumName || null,
            genre: candidate.genre || null,
            score: candidate.score,
            noveltyScore: candidate.noveltyScore,
            scoreComponents: {
              ...candidate.components, position: candidate.position,
              previewIdentity: previews.get(coverKey(candidate))?.identity ?? null,
            } as any,
            rank: idx + 1,
            status: "PENDING",
            reason: candidate.reason,
            artistId: candidate.artistId || null,
            trackId: candidate.trackId || null,
            coverUrl: covers.get(coverKey(candidate)) ?? null,
            previewUrl: previews.get(coverKey(candidate))?.url ?? null,
            appleMusicUrl: previews.get(coverKey(candidate))?.appleMusicUrl ?? null,
          })),
        },
      },
      include: sessionInclude(userId),
    });

    return toSessionResult(session);
  }

  async submitFeedback(
    userId: string,
    itemId: string,
    feedbackType: FeedbackType,
    note?: string,
    sessionId?: string,
    options: FeedbackOptions = {},
  ) {
    return new SessionMemoryService().recordFeedback(userId, itemId, feedbackType, note, sessionId, options);
  }

  async getSession(sessionId: string, userId: string): Promise<SessionResult | null> {
    const session = await prisma.recommendationSession.findFirst({
      where: { id: sessionId, userId },
      include: sessionInclude(userId),
    });

    if (!session) return null;

    return toSessionResult(session);
  }

  async getLatestSession(userId: string): Promise<SessionResult | null> {
    const session = await prisma.recommendationSession.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: sessionInclude(userId),
    });

    if (!session) return null;

    return toSessionResult(session);
  }

  private async buildUserProfile(userId: string, period: string): Promise<UserProfile> {

    const durationDays = period === "7d" ? 7 : period === "1y" ? 365 : 30;
    const since = period === "all" ? new Date(0) : new Date(Date.now() - durationDays * 24 * 60 * 60 * 1000);

    const topArtistsGrouped = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName"],
      where: { userId, playedAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    });

    const topArtistNames = topArtistsGrouped.map((a: any) => a.rawArtistName);

    const allArtists = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName"],
      where: { userId },
    });
    const knownArtistNames = new Set(allArtists.map((a: any) => a.rawArtistName.toLowerCase()));

    const allTracks = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName", "rawTrackName"],
      where: { userId },
    });
    const knownTrackKeys = new Set(
      allTracks.map((t: any) => `${t.rawArtistName.toLowerCase()}|${t.rawTrackName.toLowerCase()}`)
    );

    const enrichedArtists = await prisma.artist.findMany({
      where: { name: { in: topArtistNames }, tags: { not: null } },
      select: { tags: true },
    });

    const genreCounts = new Map<string, number>();
    for (const artist of enrichedArtists) {
      if (artist.tags) {
        for (const tag of filterGenreTags(artist.tags.split(","))) {
          genreCounts.set(tag.toLowerCase(), (genreCounts.get(tag.toLowerCase()) || 0) + 1);
        }
      }
    }
    const topGenres = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([genre]) => genre);

    const feedbackRecords = await prisma.recommendationFeedback.findMany({
      where: { userId },
      include: { item: { select: { artistName: true, trackName: true } } },
      orderBy: { createdAt: "desc" },
    });

    const feedbackMap = new Map<string, FeedbackType>();
    for (const [key, states] of effectiveTrackFeedback(feedbackRecords)) {
      if (states.preference) feedbackMap.set(key, states.preference.type as FeedbackType);
      if (states.familiarity?.type === "ALREADY_KNOW") {
        const item = states.familiarity.item;
        knownTrackKeys.add(`${item.artistName.toLowerCase()}|${item.trackName.toLowerCase()}`);
      }
    }

    const totalPlays = await prisma.listeningEvent.count({
      where: { userId, playedAt: { gte: since } },
    });

    return {
      topArtistNames,
      topGenres,
      knownArtistNames,
      knownTrackKeys,
      feedbackMap,
      totalPlays,
      uniqueArtists: knownArtistNames.size,
    };
  }

  private async generateCandidates(
    userId: string,
    profile: UserProfile,
    mode: RecommendationMode,
    dials: DiscoveryDials = MODE_DIALS[mode]
  ): Promise<RawCandidate[]> {
    const candidates: RawCandidate[] = [];

    if (profile.topGenres.length > 0) {
      const genrePatterns = profile.topGenres.slice(0, 5);
      for (const genre of genrePatterns) {
        const similarArtists = await prisma.artist.findMany({
          where: {
            tags: { contains: genre },
            NOT: { name: { in: profile.topArtistNames } },
            metadataStatus: "RESOLVED",
          },
          take: 4,
          include: {
            tracks: { take: 1, orderBy: { listeningEvents: { _count: "desc" } } },
          },
        });

        for (const artist of similarArtists) {
          const track = artist.tracks[0];
          if (!track) continue;
          candidates.push({
            artistName: artist.name,
            trackName: track.name,
            albumName: undefined,
            genre: artist.tags?.split(",").slice(0, 3).join(" / ") || genre,
            source: "genre_adjacency",
            sourceArtistName: undefined,
            artistId: artist.id,
            trackId: track.id,
          });
        }
      }
    }

    for (const artistName of profile.topArtistNames.slice(0, 5)) {
      const artist = await prisma.artist.findFirst({
        where: { name: artistName },
        include: {
          tracks: {
            orderBy: { listeningEvents: { _count: "asc" } },
            take: 3,
          },
        },
      });

      if (artist) {
        for (const track of artist.tracks) {
          const trackKey = `${artistName.toLowerCase()}|${track.name.toLowerCase()}`;
          if (!profile.knownTrackKeys.has(trackKey)) {
            candidates.push({
              artistName: artist.name,
              trackName: track.name,
              albumName: undefined,
              genre: artist.tags?.split(",").slice(0, 3).join(" / ") || undefined,
              source: "top_artist_deep_cut",
              sourceArtistName: artistName,
              artistId: artist.id,
              trackId: track.id,
            });
          }
        }
      }
    }

    if (profile.topGenres.length >= 2) {
      const multiGenreArtists = await prisma.artist.findMany({
        where: {
          AND: [
            { tags: { contains: profile.topGenres[0] } },
            { tags: { contains: profile.topGenres[1] } },
          ],
          NOT: { name: { in: profile.topArtistNames } },
          metadataStatus: "RESOLVED",
        },
        take: 6,
        include: {
          tracks: { take: 1, orderBy: { listeningEvents: { _count: "desc" } } },
        },
      });

      for (const artist of multiGenreArtists) {
        const track = artist.tracks[0];
        if (!track) continue;
        candidates.push({
          artistName: artist.name,
          trackName: track.name,
          albumName: undefined,
          genre: artist.tags?.split(",").slice(0, 3).join(" / ") || undefined,
          source: "artist_graph",
          artistId: artist.id,
          trackId: track.id,
        });
      }
    }

    candidates.push(...(await this.fetchExternalCandidates(profile, mode, dials)));

    const seen = new Set<string>();
    const unique = candidates.filter((c) => {
      const key = `${c.artistName.toLowerCase()}|${c.trackName.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return limitPerArtist(unique, MAX_TRACKS_PER_ARTIST);
  }

  /**
   * A única fonte que enxerga além do que o usuário já ouviu.
   *
   * O modo decide a distância: SAFE fica nos vizinhos mais próximos das
   * sementes do topo; EXPERIMENTAL usa sementes mais fundas do perfil e
   * prefere os vizinhos de menor afinidade, que é onde mora a surpresa.
   */
  private async fetchExternalCandidates(
    profile: UserProfile,
    mode: RecommendationMode,
    dials: DiscoveryDials = MODE_DIALS[mode]
  ): Promise<RawCandidate[]> {
    if (!this.similarArtists.isConfigured() || profile.topArtistNames.length === 0) return [];

    const seeds =
      mode === "EXPERIMENTAL"
        ? profile.topArtistNames.slice(0, 8)
        : profile.topArtistNames.slice(0, mode === "SAFE" ? 4 : 5);

    const perSeed = await Promise.all(
      seeds.map(async (seed) => ({
        seed,
        similar: await this.similarArtists.getSimilarArtists(seed, 15),
      }))
    );

    // um artista pode ser vizinho de várias sementes; fica com a mais forte
    const bestBySeed = new Map<string, { name: string; match: number; seed: string }>();
    for (const { seed, similar } of perSeed) {
      for (const artist of similar) {
        const key = artist.name.toLowerCase();
        if (isCollaborationOfKnownArtist(artist.name, profile.knownArtistNames)) continue;
        const current = bestBySeed.get(key);
        if (!current || artist.match > current.match) {
          bestBySeed.set(key, { name: artist.name, match: artist.match, seed });
        }
      }
    }

    // o alvo é o controle: procuramos quem cai perto dele, não o extremo
    const target = dials.proximity / 100;
    const ranked = [...bestBySeed.values()].sort(
      (a, b) => Math.abs(a.match - target) - Math.abs(b.match - target)
    );
    const picks = ranked.slice(0, EXTERNAL_ARTIST_LIMIT);
    if (picks.length === 0) return [];

    // se o artista já existe no catálogo local, aproveitamos tags e id reais
    const local = await prisma.artist.findMany({
      where: { name: { in: picks.map((pick) => pick.name) } },
      select: { id: true, name: true, tags: true },
    });
    const localByName = new Map(local.map((artist) => [artist.name.toLowerCase(), artist]));

    // faixa e tamanho de plateia na mesma passada: os dois alimentam os eixos
    const withTracks = await Promise.all(
      picks.map(async (pick) => {
        const [tracks, reach] = await Promise.all([
          this.similarArtists.getTopTracks(pick.name, 1),
          this.similarArtists.getArtistReach(pick.name).catch(() => null),
        ]);
        return { pick, tracks, listeners: reach?.listeners };
      })
    );

    const candidates: RawCandidate[] = [];
    for (const { pick, tracks, listeners } of withTracks) {
      const match = localByName.get(pick.name.toLowerCase());
      for (const track of tracks) {
        candidates.push({
          artistName: pick.name,
          trackName: track.trackName,
          albumName: undefined,
          genre: match?.tags?.split(",").slice(0, 3).map((tag) => tag.trim()).join(" / ") || undefined,
          source: "similar_artist",
          sourceArtistName: pick.seed,
          artistId: match?.id,
          trackId: undefined,
          match: pick.match,
          listeners,
        });
      }
    }

    return candidates;
  }

  /**
   * A prévia é o que transforma a tela de sugestões em algo que se escuta
   * em vez de se ler. Buscamos só para os itens que sobraram na sessão.
   */
  private async resolvePreviews(candidates: ScoredCandidate[]): Promise<Map<string, TrackPreview>> {
    const resolved = new Map<string, TrackPreview>();

    const found = await Promise.all(
      candidates.map(async (candidate) => ({
        key: coverKey(candidate),
        preview: await this.previews
          .findPreview(candidate.artistName, candidate.trackName)
          .catch(() => null),
      })),
    );

    for (const { key, preview } of found) {
      if (preview?.url) resolved.set(key, preview);
    }

    return resolved;
  }

  /**
   * Uma capa pode ter faltado por falha de rede na hora em que a sessão
   * nasceu. Ao reabrir, tentamos de novo só o que está faltando e
   * guardamos o resultado — a próxima abertura já não paga nada.
   */
  private async backfillCovers(
    items: Array<Record<string, any>>,
  ): Promise<Array<Record<string, any>>> {
    const missing = items.filter((item) => !item.coverUrl);
    if (missing.length === 0) return items;

    const found = await Promise.all(
      missing.map(async (item) => ({
        id: item.id,
        url:
          (await this.trackCovers
            .findTrackCover(item.artistName, item.trackName)
            .catch(() => null))?.url ?? null,
      })),
    );

    const resolved = new Map(found.filter((entry) => entry.url).map((entry) => [entry.id, entry.url as string]));
    if (resolved.size === 0) return items;

    await Promise.all(
      [...resolved.entries()].map(([id, coverUrl]) =>
        prisma.recommendationItem.update({ where: { id }, data: { coverUrl } }).catch(() => null),
      ),
    );

    return items.map((item) => (resolved.has(item.id) ? { ...item, coverUrl: resolved.get(item.id) } : item));
  }

  /**
   * Só os itens que sobraram na sessão pedem capa — buscar para os 18
   * candidatos seria pagar rede por coisa que não vai aparecer.
   *
   * Primeiro tenta a faixa no provedor, porque devolve a capa do álbum
   * correto; se não houver, cai para qualquer capa já guardada daquele
   * artista no catálogo local.
   */
  private async resolveCovers(candidates: ScoredCandidate[]): Promise<Map<string, string>> {
    const resolved = new Map<string, string>();
    if (candidates.length === 0) return resolved;

    const found = await Promise.all(
      candidates.map(async (candidate) => {
        const cover = await this.trackCovers
          .findTrackCover(candidate.artistName, candidate.trackName)
          .catch(() => null);
        return { candidate, url: cover?.url ?? null };
      }),
    );

    const missing: ScoredCandidate[] = [];
    for (const { candidate, url } of found) {
      if (url) resolved.set(coverKey(candidate), url);
      else missing.push(candidate);
    }

    const artistIds = [...new Set(missing.map((candidate) => candidate.artistId).filter(Boolean))] as string[];
    if (artistIds.length === 0) return resolved;

    const localAlbums = await prisma.album.findMany({
      where: { artistId: { in: artistIds }, coverUrl: { not: null } },
      select: { artistId: true, coverUrl: true },
    });
    const byArtist = new Map<string, string>();
    for (const album of localAlbums) {
      if (album.artistId && album.coverUrl && !byArtist.has(album.artistId)) {
        byArtist.set(album.artistId, album.coverUrl);
      }
    }

    for (const candidate of missing) {
      const fallback = candidate.artistId ? byArtist.get(candidate.artistId) : undefined;
      if (fallback) resolved.set(coverKey(candidate), fallback);
    }

    return resolved;
  }

  private async applyExclusions(
    userId: string,
    candidates: RawCandidate[],
    profile: UserProfile
  ): Promise<RawCandidate[]> {

    const cooldownDate = new Date(
      Date.now() - RECENT_RECOMMENDATION_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
    );
    // Só entra em cooldown o que a pessoa de fato julgou. Uma sugestão
    // que ela nunca respondeu merece voltar — antes, qualquer sessão
    // gerada e nunca vista sumia com o candidato por duas semanas.
    const recentItems = await prisma.recommendationItem.findMany({
      where: {
        session: { userId },
        OR: [{ exposedAt: { gte: cooldownDate } }, { feedback: { some: { userId, createdAt: { gte: cooldownDate } } } }],
      },
      select: { artistName: true, trackName: true },
    });
    const recentKeys = new Set(
      recentItems.map((i: any) => `${i.artistName.toLowerCase()}|${i.trackName.toLowerCase()}`)
    );

    return candidates.filter((c) => {
      const trackKey = `${c.artistName.toLowerCase()}|${c.trackName.toLowerCase()}`;

      if (profile.knownTrackKeys.has(trackKey)) return false;

      if (recentKeys.has(trackKey)) return false;

      if (profile.feedbackMap.get(trackFeedbackKey(c.artistName, c.trackName)) === "DISLIKED") return false;

      return true;
    });
  }
}
