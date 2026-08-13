/**
 * Recommendation Service
 *
 * Blueprint §10: Orchestrates the two-stage recommendation pipeline:
 * 1. Build user profile from stored statistics
 * 2. Generate candidates from similar artists/tracks and genre adjacency
 * 3. Apply exclusions (already listened, recently recommended, disliked)
 * 4. Score and rank deterministically
 * 5. Persist session with score components
 *
 * Blueprint §12: Feedback persistence and influence on future sessions.
 */

import { prisma } from "@/lib/db/prisma";
import { scoreAndRank, type UserProfile } from "../domain/scoring";
import {
  type RecommendationMode,
  type RecommendationContext,
  type FeedbackType,
  type RawCandidate,
  ALGORITHM_VERSION,
  DEFAULT_SESSION_SIZE,
  RECENT_RECOMMENDATION_COOLDOWN_DAYS,
} from "../domain/recommendation.types";

export interface GenerateSessionInput {
  userId: string;
  mode: RecommendationMode;
  context?: RecommendationContext;
  period?: string;
  size?: number;
}

export interface SessionResult {
  sessionId: string;
  mode: RecommendationMode;
  context: string | null;
  algorithmVersion: string;
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
    reason: string | null;
  }>;
}

export class RecommendationService {
  /**
   * Generate a new recommendation session for a user.
   */
  async generateSession(input: GenerateSessionInput): Promise<SessionResult> {
    const { userId, mode, context, period = "30d", size = DEFAULT_SESSION_SIZE } = input;

    // 1. Build user profile
    const profile = await this.buildUserProfile(userId, period);

    // 2. Generate candidates
    const rawCandidates = await this.generateCandidates(userId, profile, mode);

    // 3. Apply exclusions
    const filtered = await this.applyExclusions(userId, rawCandidates, profile);

    // 4. Score, rank and take top N
    const scored = scoreAndRank(filtered, profile, mode).slice(0, size);

    // 5. Persist session
    const session = await prisma.recommendationSession.create({
      data: {
        userId,
        mode,
        context: context || "GENERAL",
        profilePeriod: period,
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
            scoreComponents: candidate.components as any,
            rank: idx + 1,
            status: "PENDING",
            reason: candidate.reason,
            artistId: candidate.artistId || null,
            trackId: candidate.trackId || null,
          })),
        },
      },
      include: { items: { orderBy: { rank: "asc" } } },
    });

    return {
      sessionId: session.id,
      mode: session.mode as RecommendationMode,
      context: session.context,
      algorithmVersion: session.algorithmVersion,
      items: session.items.map((item: any) => ({
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
        reason: item.reason,
      })),
    };
  }

  /**
   * Submit feedback for a recommendation item.
   * Blueprint §12.1: Feedback has distinct meanings and influences.
   */
  async submitFeedback(
    userId: string,
    itemId: string,
    feedbackType: FeedbackType,
    note?: string
  ): Promise<{ success: boolean }> {
    // Verify the item belongs to a session owned by this user
    const item = await prisma.recommendationItem.findUnique({
      where: { id: itemId },
      include: { session: true },
    });

    if (!item || item.session.userId !== userId) {
      throw new Error("Recommendation item not found or unauthorized");
    }

    // Map feedback type to item status
    const statusMap: Record<FeedbackType, string> = {
      LIKED: "LIKED",
      DISLIKED: "DISLIKED",
      ALREADY_KNOW: "KNOWN",
      NOT_INTERESTED: "NOT_INTERESTED",
      SAVE_FOR_LATER: "SAVED",
    };

    // Update item status
    await prisma.recommendationItem.update({
      where: { id: itemId },
      data: { status: statusMap[feedbackType] },
    });

    // Persist feedback record
    await prisma.recommendationFeedback.create({
      data: {
        itemId,
        userId,
        type: feedbackType,
        note: note || null,
      },
    });

    return { success: true };
  }

  /**
   * Get an existing session with its items.
   */
  async getSession(sessionId: string, userId: string): Promise<SessionResult | null> {
    const session = await prisma.recommendationSession.findFirst({
      where: { id: sessionId, userId },
      include: { items: { orderBy: { rank: "asc" } } },
    });

    if (!session) return null;

    return {
      sessionId: session.id,
      mode: session.mode as RecommendationMode,
      context: session.context,
      algorithmVersion: session.algorithmVersion,
      items: session.items.map((item: any) => ({
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
        reason: item.reason,
      })),
    };
  }

  /**
   * Get the user's latest active session.
   */
  async getLatestSession(userId: string): Promise<SessionResult | null> {
    const session = await prisma.recommendationSession.findFirst({
      where: { userId, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
      include: { items: { orderBy: { rank: "asc" } } },
    });

    if (!session) return null;

    return {
      sessionId: session.id,
      mode: session.mode as RecommendationMode,
      context: session.context,
      algorithmVersion: session.algorithmVersion,
      items: session.items.map((item: any) => ({
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
        reason: item.reason,
      })),
    };
  }

  // ─── Private Methods ───────────────────────────────────────────────

  /**
   * Build the user's listening profile from stored data.
   */
  private async buildUserProfile(userId: string, period: string): Promise<UserProfile> {
    // Get top artists for the period
    const durationDays = period === "7d" ? 7 : period === "1y" ? 365 : 30;
    const since = new Date(Date.now() - durationDays * 24 * 60 * 60 * 1000);

    const topArtistsGrouped = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName"],
      where: { userId, playedAt: { gte: since } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 20,
    });

    const topArtistNames = topArtistsGrouped.map((a: any) => a.rawArtistName);

    // Get all known artists
    const allArtists = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName"],
      where: { userId },
    });
    const knownArtistNames = new Set(allArtists.map((a: any) => a.rawArtistName.toLowerCase()));

    // Get all known tracks
    const allTracks = await prisma.listeningEvent.groupBy({
      by: ["rawArtistName", "rawTrackName"],
      where: { userId },
    });
    const knownTrackKeys = new Set(
      allTracks.map((t: any) => `${t.rawArtistName.toLowerCase()}|${t.rawTrackName.toLowerCase()}`)
    );

    // Get top genres from enriched artist tags
    const enrichedArtists = await prisma.artist.findMany({
      where: { name: { in: topArtistNames }, tags: { not: null } },
      select: { tags: true },
    });

    const genreCounts = new Map<string, number>();
    for (const artist of enrichedArtists) {
      if (artist.tags) {
        for (const tag of artist.tags.split(",").map((t: string) => t.trim()).filter(Boolean)) {
          genreCounts.set(tag.toLowerCase(), (genreCounts.get(tag.toLowerCase()) || 0) + 1);
        }
      }
    }
    const topGenres = [...genreCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([genre]) => genre);

    // Get feedback from previous sessions
    const feedbackRecords = await prisma.recommendationFeedback.findMany({
      where: { userId },
      include: { item: { select: { artistName: true } } },
      orderBy: { createdAt: "desc" },
    });

    const feedbackMap = new Map<string, FeedbackType>();
    for (const fb of feedbackRecords) {
      const key = fb.item.artistName.toLowerCase();
      if (!feedbackMap.has(key)) {
        feedbackMap.set(key, fb.type as FeedbackType);
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

  /**
   * Generate raw candidates from the user's profile.
   * Sources: similar artists (tag-based), genre adjacency, deep cuts from top artists.
   */
  private async generateCandidates(
    userId: string,
    profile: UserProfile,
    mode: RecommendationMode
  ): Promise<RawCandidate[]> {
    const candidates: RawCandidate[] = [];

    // Strategy 1: Find artists with similar tags/genres (genre adjacency)
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
          candidates.push({
            artistName: artist.name,
            trackName: track?.name || "Popular Track",
            albumName: undefined,
            genre: artist.tags?.split(",").slice(0, 3).join(" / ") || genre,
            source: "genre_adjacency",
            sourceArtistName: undefined,
            artistId: artist.id,
            trackId: track?.id,
          });
        }
      }
    }

    // Strategy 2: Deep cuts from top artists (tracks the user hasn't listened to)
    for (const artistName of profile.topArtistNames.slice(0, 5)) {
      const artist = await prisma.artist.findFirst({
        where: { name: artistName },
        include: {
          tracks: {
            orderBy: { listeningEvents: { _count: "asc" } }, // Least-listened first
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

    // Strategy 3: Artists connected to multiple top artists (artist graph)
    // Find artists that share tags with multiple top artists
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
        candidates.push({
          artistName: artist.name,
          trackName: track?.name || "Popular Track",
          albumName: undefined,
          genre: artist.tags?.split(",").slice(0, 3).join(" / ") || undefined,
          source: "artist_graph",
          artistId: artist.id,
          trackId: track?.id,
        });
      }
    }

    // Deduplicate candidates by artist+track
    const seen = new Set<string>();
    return candidates.filter((c) => {
      const key = `${c.artistName.toLowerCase()}|${c.trackName.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Apply exclusions per Blueprint §10.3.
   */
  private async applyExclusions(
    userId: string,
    candidates: RawCandidate[],
    profile: UserProfile
  ): Promise<RawCandidate[]> {
    // Get recently recommended items (within cooldown)
    const cooldownDate = new Date(
      Date.now() - RECENT_RECOMMENDATION_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
    );
    const recentItems = await prisma.recommendationItem.findMany({
      where: {
        session: { userId, createdAt: { gte: cooldownDate } },
      },
      select: { artistName: true, trackName: true },
    });
    const recentKeys = new Set(
      recentItems.map((i: any) => `${i.artistName.toLowerCase()}|${i.trackName.toLowerCase()}`)
    );

    // Get disliked artist names
    const dislikedFeedback = await prisma.recommendationFeedback.findMany({
      where: { userId, type: "DISLIKED" },
      include: { item: { select: { artistName: true } } },
    });
    const dislikedArtists = new Set(
      dislikedFeedback.map((f: any) => f.item.artistName.toLowerCase())
    );

    return candidates.filter((c) => {
      const trackKey = `${c.artistName.toLowerCase()}|${c.trackName.toLowerCase()}`;

      // Exclude already listened tracks
      if (profile.knownTrackKeys.has(trackKey)) return false;

      // Exclude recently recommended
      if (recentKeys.has(trackKey)) return false;

      // Exclude disliked artists (with strong suppression)
      if (dislikedArtists.has(c.artistName.toLowerCase())) return false;

      return true;
    });
  }
}
