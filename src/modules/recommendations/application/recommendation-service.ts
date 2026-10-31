

import { prisma } from "@/lib/db/prisma";
import { filterGenreTags } from "@/modules/enrichment/domain/genre-tags";
import { scoreAndRank, RANKING_VERSION, type UserProfile } from "../domain/scoring";
import { scoreAndRank as legacyScoreAndRank } from "../domain/legacy-scoring";
import { tasteSlice, representativeTracks, PROFILE_WEIGHTS, type TrackSeed } from "../domain/taste-profile";
import { composeSession } from "../domain/composition";
import { eligibleCandidates } from "../domain/eligibility";
import { algorithmVersion, discoveryStrategy, type DiscoveryStrategy } from "../domain/strategy";
import { hybridExternalCandidates, mergeCandidates } from "./hybrid-candidates";
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
  type RecommendationEvidence,
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
      const rawEvidence = (item.scoreComponents as any)?.evidence;
      const evidence: RecommendationEvidence[] = Array.isArray(rawEvidence)
        ? rawEvidence.filter((entry) => entry && typeof entry.kind === "string" && typeof entry.source === "string") : [];
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
      evidence,
      isRevisit: (item.scoreComponents as any)?.isRevisit ?? false,
      sourceUrl: evidence.some((entry) => entry.source === "lastfm")
        ? `https://www.last.fm/music/${encodeURIComponent(item.artistName)}/_/${encodeURIComponent(item.trackName)}` : null,
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
    evidence: RecommendationEvidence[];
    isRevisit: boolean;
    sourceUrl: string | null;
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
    private strategy: DiscoveryStrategy = discoveryStrategy(),
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
      if (source.algorithmVersion !== algorithmVersion(this.strategy)) throw new DiscoveryConflict("Essa sessão usa outra versão do motor. Escolha outra entrada para iniciar uma nova busca.");
      const settings = sessionSettings(source.profilePeriod, source.mode, source.context);
      effective = { ...input, ...settings };
    }
    const { userId, mode, context, period = "30d", size = DEFAULT_SESSION_SIZE } = effective;
    const dials = effective.dials ?? MODE_DIALS[mode];
    const fingerprint = JSON.stringify({ operation, source: input.sessionId ?? null, mode,
      context: context || "GENERAL", period, dials, size, algorithm: algorithmVersion(this.strategy) });
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
          algorithmVersion: algorithmVersion(this.strategy),
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
        algorithmVersion: algorithmVersion(this.strategy), status: "GENERATING", currentRank: 1,
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
    const generationStarted = Date.now();
    const { userId, mode, context, period = "30d", size = DEFAULT_SESSION_SIZE } = input;
    const dials = input.dials ?? MODE_DIALS[mode];
    const profile = await this.buildUserProfile(userId, period);

    const rawCandidates = await this.generateCandidates(userId, profile, mode, dials);

    const excluded = new Set(avoid.map(coverKey));
    const filtered = (await this.applyExclusions(userId, rawCandidates, profile)).filter((candidate) => !excluded.has(coverKey(candidate)));

    const ranked = this.strategy === "legacy" ? legacyScoreAndRank(filtered, profile, mode, dials) : scoreAndRank(filtered, profile, mode, dials);
    const scored = this.strategy === "legacy" ? ranked.slice(0, size) : composeSession(ranked, size);

    const covers = await this.resolveCovers(scored);
    const previews = this.strategy === "legacy" ? await this.resolvePreviews(scored) : new Map<string, TrackPreview>();
    // Artwork is independent of audio availability. Only probe missing covers,
    // for up to four final items; never perform another Apple search here.
    // Hybrid media loads separately for the visible item.

    const session = await prisma.recommendationSession.update({
      where: { id: sessionId },
      data: {
        userId,
        mode,
        context: context || "GENERAL",
        profilePeriod: `${period}:${dials.proximity}:${dials.fame}`,
        algorithmVersion: algorithmVersion(this.strategy),
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
              ...(this.strategy === "hybrid" ? { rankingVersion: RANKING_VERSION, candidate: JSON.parse(JSON.stringify(candidate)),
                evidence: candidate.evidence ?? [], isRevisit: candidate.isRevisit ?? false,
                profileCoverage: { longTerm: profile.longTerm?.genreCoverage ?? null, recent: profile.recent?.genreCoverage ?? null } } : {}),
              ...(this.strategy === "hybrid" ? { profileContext: { referenceTime: profile.referenceTime ?? null, longTermPlays: profile.longTerm?.totalPlays ?? null,
                recentPlays: profile.recent?.totalPlays ?? null, weights: PROFILE_WEIGHTS } } : {}),
              providerDiagnostics: this.similarArtists.getDiagnostics?.() ?? null,
              ...(this.strategy === "legacy" && candidate.source === "similar_artist" ? { evidence: [{ kind: "artist_similarity", source: "lastfm", seedArtist: candidate.sourceArtistName }] } : {}),
            } as any,
            rank: idx + 1,
            status: "PENDING",
            reason: candidate.reason,
            artistId: candidate.artistId || null,
            trackId: candidate.trackId || null,
            coverUrl: previews.get(coverKey(candidate))?.artworkUrl ?? covers.get(coverKey(candidate)) ?? null,
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
    const result = await new SessionMemoryService().recordFeedback(userId, itemId, feedbackType, note, sessionId, options);
    if (this.strategy !== "hybrid" || !sessionId || !["LIKED", "DISLIKED", "RETRACTED"].includes(feedbackType)) return result;
    try {
      const changed = await this.refreshUnseenSession(userId, sessionId, itemId);
      return changed ? { ...result, session: await this.getSession(sessionId, userId) } : result;
    } catch {
      // The decision is already committed. A ranking failure must not claim
      // that saving the user's response failed or ask them to vote twice.
      return { ...result, queueRefreshDeferred: true };
    }
  }

  private async refreshUnseenSession(userId: string, sessionId: string, votedItemId: string): Promise<boolean> {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "RecommendationSession" WHERE "id" = ${sessionId} AND "userId" = ${userId} FOR UPDATE`;
      const session = await tx.recommendationSession.findFirst({ where: { id: sessionId, userId }, include: sessionInclude(userId) });
      if (!session || session.algorithmVersion !== algorithmVersion("hybrid")) return false;
      const voted = session.items.find((item) => item.id === votedItemId);
      if (!voted) return false;
      const pending = session.items.filter((item) => !item.exposedAt && !item.feedback.length && item.rank >= (session.currentRank ?? 1));
      const parse = (item: typeof session.items[number]): RawCandidate | null => {
        const snapshot = (item.scoreComponents as Record<string, unknown> | null)?.candidate as RawCandidate | undefined;
        if (!snapshot || snapshot.artistName !== item.artistName || snapshot.trackName !== item.trackName || !Array.isArray(snapshot.evidence)) return null;
        return snapshot;
      };
      const pool = pending.flatMap((item) => { const candidate = parse(item); return candidate ? [{ item, candidate }] : []; });
      const key = trackFeedbackKey(voted.artistName, voted.trackName);
      if (!pool.some(({ candidate }) => candidate.evidence?.some((evidence) => evidence.seedArtist && evidence.seedTrack
        && trackFeedbackKey(evidence.seedArtist, evidence.seedTrack) === key))) return false;
      // Profile reads happen under the same session lock as feedback/exposure,
      // so an older refresh cannot overwrite a later decision or visible item.
      const settings = sessionSettings(session.profilePeriod, session.mode, session.context);
      const profile = await this.buildUserProfile(userId, settings.period);
      const ranked = scoreAndRank(pool.map(({ candidate }) => candidate), profile, settings.mode, settings.dials);
      const ordered = [...ranked.filter((item) => !item.isRevisit), ...ranked.filter((item) => item.isRevisit)];
      const slots = pool.map(({ item }) => item.rank).sort((a, b) => a - b);
      let changed = false;
      for (const [index, candidate] of ordered.entries()) {
        const original = pool.find(({ item }) => trackFeedbackKey(item.artistName, item.trackName) === trackFeedbackKey(candidate.artistName, candidate.trackName))!.item;
        if (original.rank === slots[index] && original.score === candidate.score && original.reason === candidate.reason) continue;
        await tx.recommendationItem.update({ where: { id: original.id }, data: { rank: slots[index], score: candidate.score, reason: candidate.reason,
          scoreComponents: JSON.parse(JSON.stringify({ ...(original.scoreComponents as Record<string, unknown> ?? {}),
            ...candidate.components, candidate, evidence: candidate.evidence, rankingVersion: RANKING_VERSION })) } });
        changed = true;
      }
      return changed;
    });
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
    if (this.strategy === "legacy") return this.buildLegacyProfile(userId, period);
    const reference = new Date();
    const days = period === "7d" ? 7 : period === "1y" ? 365 : 30;
    const recentWhere = { userId, playedAt: { gte: new Date(reference.getTime() - days * 86_400_000) } };
    const [longArtists, recentArtists, longTracks, recentTracks, feedback] = await Promise.all([
      prisma.listeningEvent.groupBy({ by: ["rawArtistName"], where: { userId }, _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
      prisma.listeningEvent.groupBy({ by: ["rawArtistName"], where: recentWhere, _count: { id: true }, orderBy: { _count: { id: "desc" } } }),
      prisma.listeningEvent.groupBy({ by: ["rawArtistName", "rawTrackName"], where: { userId }, _count: { id: true }, _max: { playedAt: true }, orderBy: { _count: { id: "desc" } } }),
      prisma.listeningEvent.groupBy({ by: ["rawArtistName", "rawTrackName"], where: recentWhere, _count: { id: true }, _max: { playedAt: true }, orderBy: { _count: { id: "desc" } } }),
      prisma.recommendationFeedback.findMany({ where: { userId }, include: { item: { select: { artistName: true, trackName: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
    ]);
    const feedbackMap = new Map<string, FeedbackType>();
    const likedTracks: Array<{ artistName: string; trackName: string }> = [];
    const knownTrackKeys = new Set(longTracks.map((track) => track.rawArtistName.toLowerCase() + "|" + track.rawTrackName.toLowerCase()));
    for (const [key, state] of effectiveTrackFeedback(feedback)) {
      if (state.preference) feedbackMap.set(key, state.preference.type as FeedbackType);
      if (state.preference?.type === "LIKED") likedTracks.push(state.preference.item);
      if (state.familiarity?.type === "ALREADY_KNOW") knownTrackKeys.add(state.familiarity.item.artistName.toLowerCase() + "|" + state.familiarity.item.trackName.toLowerCase());
    }
    const names = [...new Set([...longArtists.slice(0, 60), ...recentArtists.slice(0, 30)].map((artist) => artist.rawArtistName))];
    const metadata = names.length ? await prisma.artist.findMany({ where: { name: { in: names }, metadataStatus: "RESOLVED", tags: { not: null } }, select: { name: true, tags: true } }) : [];
    const genres = new Map<string, string[]>();
    for (const artist of metadata) {
      const key = artist.name.toLowerCase();
      // A name collision cannot choose one artist's genre arbitrarily.
      const matches = metadata.filter((row) => row.name.toLowerCase() === key);
      if (matches.length === 1) genres.set(key, filterGenreTags(artist.tags?.split(",") ?? []));
    }
    const tracks = (rows: typeof longTracks, region: TrackSeed["region"]): TrackSeed[] => rows.map((row) => ({ artistName: row.rawArtistName,
      trackName: row.rawTrackName, plays: row._count.id, lastPlayedAt: row._max.playedAt?.toISOString(), region }));
    const longTerm = tasteSlice(longArtists.map((row) => ({ name: row.rawArtistName, plays: row._count.id })), tracks(longTracks, "long_term"), genres);
    const recent = tasteSlice(recentArtists.map((row) => ({ name: row.rawArtistName, plays: row._count.id })), tracks(recentTracks, "recent"), genres);
    const blend = new Map<string, number>();
    for (const [slice, weight] of [[longTerm, PROFILE_WEIGHTS.longTerm], [recent, PROFILE_WEIGHTS.recent]] as const) for (const artist of slice.artists) blend.set(artist.name, (blend.get(artist.name) ?? 0) + weight * artist.share);
    const genreBlend = new Map<string, number>();
    for (const [slice, weight] of [[longTerm, PROFILE_WEIGHTS.longTerm], [recent, PROFILE_WEIGHTS.recent]] as const) for (const genre of slice.genres) genreBlend.set(genre.name, (genreBlend.get(genre.name) ?? 0) + weight * genre.share);
    return { topArtistNames: [...blend].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])).slice(0, 20).map(([name]) => name),
      topGenres: [...genreBlend].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0])).slice(0,10).map(([name]) => name),
      knownArtistNames: new Set(longArtists.map((row) => row.rawArtistName.toLowerCase())), knownTrackKeys, feedbackMap,
      totalPlays: longTerm.totalPlays, uniqueArtists: longArtists.length, longTerm, recent, likedTracks,
      trackSeeds: representativeTracks(longTerm, recent, likedTracks, feedbackMap), referenceTime: reference.toISOString() };
  }

  private async generateCandidates(userId: string, profile: UserProfile, mode: RecommendationMode, dials: DiscoveryDials): Promise<RawCandidate[]> {
    if (this.strategy === "legacy") return this.generateLegacyCandidates(userId, profile, mode, dials);
    const artists = await prisma.artist.findMany({ where: { metadataStatus: "RESOLVED", OR: [
      { name: { in: profile.topArtistNames } }, ...profile.topGenres.slice(0, 5).map((genre) => ({ tags: { contains: genre } })),
    ] }, orderBy: { name: "asc" }, take: 32, include: { tracks: { orderBy: { name: "asc" }, take: 5 } } });
    const local: RawCandidate[] = [];
    for (const artist of artists) {
      if (artists.filter((row) => row.name.toLowerCase() === artist.name.toLowerCase()).length !== 1) continue;
      const tags = filterGenreTags(artist.tags?.split(",") ?? []);
      const overlap = tags.filter((tag) => profile.topGenres.includes(tag));
      const known = profile.knownArtistNames.has(artist.name.toLowerCase());
      if (!known && !overlap.length) continue;
      for (const track of artist.tracks) local.push({ artistName: artist.name, trackName: track.name, artistId: artist.id, trackId: track.id,
        genre: tags.slice(0, 3).join(" / ") || undefined, source: known ? "top_artist_deep_cut" : "genre_adjacency",
        evidence: overlap.map((genre) => ({ kind: "genre_overlap", source: "catalog", genre })) });
    }
    const revisits: RawCandidate[] = (profile.longTerm?.tracks ?? []).filter((track) => track.plays >= 3 && track.lastPlayedAt
      && new Date(track.lastPlayedAt).getTime() < new Date(profile.referenceTime ?? Date.now()).getTime() - 90 * 86_400_000)
      .sort((a,b) => b.plays-a.plays).slice(0, 5).map((track) => ({ artistName: track.artistName, trackName: track.trackName,
        source: "history_revisit", isRevisit: true, evidence: [{ kind: "history_revisit", source: "history", lastPlayedAt: track.lastPlayedAt, playCount: track.plays }] }));
    return mergeCandidates([...local, ...await hybridExternalCandidates(this.similarArtists, profile), ...revisits]);
  }

  private async buildLegacyProfile(userId: string, period: string): Promise<UserProfile> {

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

  private async generateLegacyCandidates(
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
  private async resolveFallbackCovers(candidates: ScoredCandidate[], covers: Map<string, string>, previews: Map<string, TrackPreview>, deadline = Date.now() + 8_000): Promise<void> {
    const missing = candidates.filter((candidate) => !covers.has(coverKey(candidate)) && !previews.get(coverKey(candidate))?.artworkUrl).slice(0, 4);
    for (const candidate of missing) {
      if (Date.now() >= deadline) break;
      const cover = await this.trackCovers.findTrackCover(candidate.artistName, candidate.trackName).catch(() => null);
      if (cover?.url) covers.set(coverKey(candidate), cover.url);
    }
  }

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
    if (this.strategy === "hybrid") {
      const ids = candidates.flatMap((candidate) => candidate.artistId ? [candidate.artistId] : []);
      if (!ids.length) return resolved;
      const albums = await prisma.album.findMany({ where: { artistId: { in: ids }, coverUrl: { not: null } },
        select: { artistId: true, coverUrl: true }, orderBy: { id: "asc" } });
      for (const candidate of candidates) {
        const album = albums.find((item) => item.artistId === candidate.artistId);
        if (album?.coverUrl) resolved.set(coverKey(candidate), album.coverUrl);
      }
      return resolved;
    }

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

    return eligibleCandidates(candidates, profile, recentKeys);
  }
}
