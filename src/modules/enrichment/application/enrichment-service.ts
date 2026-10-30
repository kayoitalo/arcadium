import { prisma } from "@/lib/db/prisma";
import { isProviderUnavailable } from "../domain/provider-errors";

/** Depois deste prazo, uma entidade FAILED ganha nova chance. */
const FAILED_RETRY_DAYS = 7;
import type { Prisma } from "@prisma/client";
import { MusicBrainzAdapter } from "../infrastructure/musicbrainz-adapter";
import { CoverArtArchiveAdapter } from "../infrastructure/cover-art-archive-adapter";
import { LastFmCoverAdapter } from "../infrastructure/lastfm-cover-adapter";
import { ItunesCatalogAdapter, type CatalogTrack } from "../infrastructure/itunes-catalog-adapter";
import { compatibleRecording } from "@/lib/music/recording-match";
import type { AlbumCoverFallbackProvider, CoverArtResult } from "../domain/cover-art-provider.interface";

/** Um álbum que nenhuma fonte achou volta para a fila depois deste prazo. */
const COVER_RETRY_DAYS = 30;

export interface CatalogSummary {
  processed: number;
  /** Discos achados no catálogo da Apple. */
  matched: number;
  missing: number;
  /** Faixas suas que ganharam duração, prévia e link. */
  tracksUpdated: number;
}

export interface EnrichmentSummary {
  totalProcessed: number;
  resolved: number;
  failed: number;
  skipped: number;
  coversResolved: number;
  coversMissing: number;
  details: Array<{ name: string; status: "RESOLVED" | "FAILED" | "SKIPPED"; country?: string | null }>;
}

export interface EnrichmentCoverage {
  totalArtists: number;
  resolvedCount: number;
  failedCount: number;
  unresolvedCount: number;
  percentage: number;
  totalCanonicalAlbums: number;
  albumsWithCover: number;
  albumsWithoutCover: number;
  pendingCoverLookup: number;
  coverPercentage: number;
  /** Discos já vinculados ao catálogo da Apple. */
  albumsInCatalog: number;
  pendingCatalogLookup: number;
  totalTracks: number;
  tracksWithDuration: number;
  durationPercentage: number;
}

export class EnrichmentService {
  constructor(
    private adapter = new MusicBrainzAdapter(),
    private coverArt = new CoverArtArchiveAdapter(),
    private catalog = new ItunesCatalogAdapter(),
    /** Tentadas em ordem quando o Cover Art Archive não tem (ou o álbum nem está no MusicBrainz). */
    private fallbackCoverArt: AlbumCoverFallbackProvider[] = [new LastFmCoverAdapter(), catalog],
  ) {}

  async getCoverageStats(userId: string): Promise<EnrichmentCoverage> {
    const owned = { listeningEvents: { some: { userId } } };
    // a capa vale para todo álbum, não só para os que o MusicBrainz conhece
    const [
      totalArtists, resolvedCount, failedCount, totalCanonicalAlbums, albumsWithCover, pendingCoverLookup,
      albumsInCatalog, pendingCatalogLookup, totalTracks, tracksWithDuration,
    ] = await Promise.all([
      prisma.artist.count({ where: owned }),
      prisma.artist.count({ where: { ...owned, metadataStatus: "RESOLVED" } }),
      prisma.artist.count({ where: { ...owned, metadataStatus: "FAILED" } }),
      prisma.album.count({ where: owned }),
      prisma.album.count({ where: { ...owned, coverUrl: { not: null } } }),
      prisma.album.count({ where: { ...owned, coverFetchedAt: null } }),
      prisma.album.count({ where: { ...owned, itunesCollectionId: { not: null } } }),
      prisma.album.count({ where: { ...owned, itunesFetchedAt: null } }),
      prisma.track.count({ where: owned }),
      prisma.track.count({ where: { ...owned, durationMs: { not: null } } }),
    ]);
    const unresolvedCount = totalArtists - (resolvedCount + failedCount);
    const percentage = totalArtists ? Math.round((resolvedCount / totalArtists) * 100) : 0;
    const albumsWithoutCover = Math.max(0, totalCanonicalAlbums - albumsWithCover);
    const coverPercentage = totalCanonicalAlbums ? Math.round((albumsWithCover / totalCanonicalAlbums) * 100) : 0;

    return {
      totalArtists,
      resolvedCount,
      failedCount,
      unresolvedCount,
      percentage,
      totalCanonicalAlbums,
      albumsWithCover,
      albumsWithoutCover,
      pendingCoverLookup,
      coverPercentage,
      albumsInCatalog,
      pendingCatalogLookup,
      totalTracks,
      tracksWithDuration,
      durationPercentage: totalTracks ? Math.round((tracksWithDuration / totalTracks) * 100) : 0,
    };
  }

  /**
   * Entidades marcadas como FAILED voltam para a fila depois de um tempo.
   * Muitas falharam por rede, não por não existirem no provedor — sem
   * esta janela, elas ficariam aposentadas para sempre.
   */
  private retryCutoff(): Date {
    return new Date(Date.now() - FAILED_RETRY_DAYS * 24 * 60 * 60 * 1000);
  }

  private pendingStatusFilter() {
    return {
      OR: [
        { metadataStatus: "UNRESOLVED" },
        { metadataStatus: "FAILED", enrichedAt: { lt: this.retryCutoff() } },
      ],
    };
  }

  async enrichUnresolvedArtists(userId: string, batchSize = 5): Promise<EnrichmentSummary> {
    const recentArtistIds = await this.getRecentEntityIds(userId, "artistId", batchSize * 5);
    const recentUnresolved = recentArtistIds.length ? await prisma.artist.findMany({
      where: { id: { in: recentArtistIds }, ...this.pendingStatusFilter() },
    }) : [];
    const recentById = new Map(recentUnresolved.map((artist) => [artist.id, artist]));
    const unresolvedArtists = recentArtistIds.map((id) => recentById.get(id)).filter(Boolean).slice(0, batchSize) as typeof recentUnresolved;
    if (unresolvedArtists.length < batchSize) {
      const fallback = await prisma.artist.findMany({
        where: { ...this.pendingStatusFilter(), listeningEvents: { some: { userId } }, id: { notIn: unresolvedArtists.map((artist) => artist.id) } },
        take: batchSize - unresolvedArtists.length,
        orderBy: { id: "asc" },
      });
      unresolvedArtists.push(...fallback);
    }

    const summary: EnrichmentSummary = {
      totalProcessed: 0,
      resolved: 0,
      failed: 0,
      skipped: 0,
      coversResolved: 0,
      coversMissing: 0,
      details: [],
    };

    for (const artist of unresolvedArtists) {
      summary.totalProcessed++;

      try {
        const enriched = await this.adapter.searchArtist(artist.name, artist.mbid);

        if (enriched) {
          await prisma.artist.update({
            where: { id: artist.id },
            data: {
              mbid: enriched.mbid,
              country: enriched.country,
              type: enriched.type,
              disambiguation: enriched.disambiguation,
              tags: enriched.tags.join(","),
              metadataStatus: "RESOLVED",
              enrichedAt: new Date(),
            },
          });

          const topAlbum = await prisma.album.findFirst({
            where: { artistId: artist.id, enrichedAt: null, listeningEvents: { some: { userId } } },
            orderBy: { id: "asc" },
          });

          if (topAlbum) {
            const albumData = await this.adapter.searchAlbum(topAlbum.name, enriched.mbid);
            if (albumData) {
              await prisma.album.update({
                where: { id: topAlbum.id },
                data: {
                  mbid: albumData.mbid,
                  releaseGroupMbid: albumData.releaseGroupMbid,
                  releaseGroupFetchedAt: new Date(),
                  releaseYear: albumData.releaseYear,
                  primaryType: albumData.primaryType,
                  enrichedAt: new Date(),
                },
              });
            }
          }

          summary.resolved++;
          summary.details.push({ name: artist.name, status: "RESOLVED", country: enriched.country });
        } else {
          await prisma.artist.update({
            where: { id: artist.id },
            data: {
              metadataStatus: "FAILED",
              enrichedAt: new Date(),
            },
          });

          summary.failed++;
          summary.details.push({ name: artist.name, status: "FAILED" });
        }
      } catch (error) {
        if (isProviderUnavailable(error)) {
          // não conseguimos perguntar — o artista continua na fila
          console.warn(`[EnrichmentService] Provedor fora do ar em "${artist.name}"; será tentado de novo.`);
          summary.skipped++;
          summary.details.push({ name: artist.name, status: "SKIPPED" });
          continue;
        }

        console.error(`[EnrichmentService] Failed to enrich artist "${artist.name}":`, error);
        summary.failed++;
        summary.details.push({ name: artist.name, status: "FAILED" });
      }
    }

    await this.enrichMissingReleaseGroups(userId, batchSize);
    const coverSummary = await this.enrichMissingAlbumCovers(userId, batchSize);
    summary.coversResolved = coverSummary.resolved;
    summary.coversMissing = coverSummary.missing;
    return summary;
  }

  async enrichMissingReleaseGroups(userId: string, batchSize = 10): Promise<{ processed: number; resolved: number }> {
    const recentAlbumIds = await this.getRecentEntityIds(userId, "albumId", batchSize * 5);
    const recentAlbums = recentAlbumIds.length ? await prisma.album.findMany({
      where: { id: { in: recentAlbumIds }, releaseGroupFetchedAt: null, artist: { mbid: { not: null }, metadataStatus: { not: "IDENTITY_REVIEW" } } },
      include: { artist: { select: { mbid: true } } },
    }) : [];
    const recentById = new Map(recentAlbums.map((album) => [album.id, album]));
    const albums = recentAlbumIds.map((id) => recentById.get(id)).filter(Boolean).slice(0, batchSize) as typeof recentAlbums;
    if (albums.length < batchSize) {
      const fallback = await prisma.album.findMany({
        where: { listeningEvents: { some: { userId } }, releaseGroupFetchedAt: null, artist: { mbid: { not: null }, metadataStatus: { not: "IDENTITY_REVIEW" } }, id: { notIn: albums.map((album) => album.id) } },
        include: { artist: { select: { mbid: true } } },
        take: batchSize - albums.length,
        orderBy: { id: "asc" },
      });
      albums.push(...fallback);
    }
    let resolved = 0;

    for (const album of albums) {
      const metadata = await this.adapter.searchAlbum(album.name, album.artist.mbid!);
      await prisma.album.update({
        where: { id: album.id },
        data: {
          mbid: metadata?.mbid ?? album.mbid,
          releaseGroupMbid: metadata?.releaseGroupMbid ?? null,
          releaseYear: metadata?.releaseYear ?? album.releaseYear,
          primaryType: metadata?.primaryType ?? album.primaryType,
          releaseGroupFetchedAt: new Date(),
          enrichedAt: metadata ? new Date() : album.enrichedAt,

          coverFetchedAt: metadata?.releaseGroupMbid && !album.coverUrl ? null : album.coverFetchedAt,
        },
      });
      if (metadata?.releaseGroupMbid) resolved++;
    }

    return { processed: albums.length, resolved };
  }

  async enrichMissingAlbumCovers(userId: string, batchSize = 10): Promise<{ processed: number; resolved: number; missing: number }> {
    const retryBefore = new Date(Date.now() - COVER_RETRY_DAYS * 86_400_000);
    // qualquer álbum ainda não consultado entra: os sem vínculo no MusicBrainz
    // eram a maioria e nunca chegavam aqui, então nunca ganhavam capa
    const coverWhere: Prisma.AlbumWhereInput = { listeningEvents: { some: { userId } }, OR: [
      { coverFetchedAt: null },
      { coverUrl: null, coverFetchedAt: { lt: retryBefore } },
      { coverSource: "cover-art-archive", coverUrl: { startsWith: "https://coverartarchive.org/" } },
    ] };
    const recentAlbumIds = await this.getRecentEntityIds(userId, "albumId", batchSize * 5);
    const recentAlbums = recentAlbumIds.length ? await prisma.album.findMany({ where: { ...coverWhere, id: { in: recentAlbumIds } }, include: { artist: { select: { name: true } } } }) : [];
    const recentById = new Map(recentAlbums.map((album) => [album.id, album]));
    const albums = recentAlbumIds.map((id) => recentById.get(id)).filter(Boolean).slice(0, batchSize) as typeof recentAlbums;
    if (albums.length < batchSize) {
      const fallback = await prisma.album.findMany({
        where: { ...coverWhere, id: { notIn: albums.map((album) => album.id) } },
        take: batchSize - albums.length,
        orderBy: { id: "asc" },
        include: { artist: { select: { name: true } } },
      });
      albums.push(...fallback);
    }
    let resolved = 0;
    let missing = 0;

    for (const album of albums) {
      try {
        let cover = null;
        const repairingUnavailableArchiveUrl = album.coverUrl?.startsWith("https://coverartarchive.org/");
        if (!repairingUnavailableArchiveUrl) {
          try {
            cover = album.mbid ? await this.coverArt.findFrontCover(album.mbid) : null;
            if (!cover && album.releaseGroupMbid) cover = await this.coverArt.findReleaseGroupFrontCover(album.releaseGroupMbid);
          } catch (primaryError) {
            console.warn(`[EnrichmentService] Canonical cover unavailable for "${album.name}"; trying Last.fm.`, primaryError);
          }
        }
        if (!cover) cover = await this.findFallbackCover(album.artist.name, album.name);
        await prisma.album.update({
          where: { id: album.id },
          data: {
            coverUrl: cover?.url ?? null,
            coverSource: cover?.source ?? null,
            coverEntityType: cover?.entityType ?? null,
            coverMbid: cover?.mbid || null,
            coverFetchedAt: new Date(),
          },
        });
        cover ? resolved++ : missing++;
      } catch (error) {
        console.error(`[EnrichmentService] Cover lookup failed for album "${album.name}":`, error);
      }
    }

    return { processed: albums.length, resolved, missing };
  }

  /**
   * O catálogo da Apple, disco a disco: uma busca acha o álbum e um
   * lookup traz todas as faixas dele de uma vez. Do álbum ficam o
   * vínculo, o link, o gênero e o ano (quando o MusicBrainz não deu); das
   * faixas que você ouviu, a duração exata, a prévia e o link.
   *
   * Duas chamadas por disco no ritmo de ~19 por minuto: um lote de 6 leva
   * perto de 40 segundos. Os mais ouvidos no último mês vêm primeiro.
   */
  async enrichAlbumsFromCatalog(userId: string, batchSize = 6): Promise<CatalogSummary> {
    const retryBefore = new Date(Date.now() - COVER_RETRY_DAYS * 86_400_000);
    const catalogWhere: Prisma.AlbumWhereInput = { listeningEvents: { some: { userId } }, OR: [
      { itunesFetchedAt: null },
      { itunesCollectionId: null, itunesFetchedAt: { lt: retryBefore } },
    ] };
    const include = { artist: { select: { name: true } } } as const;

    const recentAlbumIds = await this.getRecentEntityIds(userId, "albumId", batchSize * 5);
    const recentAlbums = recentAlbumIds.length
      ? await prisma.album.findMany({ where: { ...catalogWhere, id: { in: recentAlbumIds } }, include })
      : [];
    const recentById = new Map(recentAlbums.map((album) => [album.id, album]));
    const albums = recentAlbumIds.map((id) => recentById.get(id)).filter(Boolean).slice(0, batchSize) as typeof recentAlbums;
    if (albums.length < batchSize) {
      albums.push(...await prisma.album.findMany({
        where: { ...catalogWhere, id: { notIn: albums.map((album) => album.id) } },
        take: batchSize - albums.length,
        orderBy: { id: "asc" },
        include,
      }));
    }

    const summary: CatalogSummary = { processed: albums.length, matched: 0, missing: 0, tracksUpdated: 0 };

    for (const album of albums) {
      try {
        // vínculo já guardado: vai direto às faixas, sem buscar pelo nome de novo
        if (album.itunesCollectionId) {
          const tracks = await this.catalog.lookupTracks(album.itunesCollectionId);
          await prisma.album.update({ where: { id: album.id }, data: { itunesFetchedAt: new Date() } });
          summary.matched++;
          summary.tracksUpdated += await this.applyCatalogTracks(userId, album.id, album.artistId, tracks);
          continue;
        }

        const found = await this.catalog.searchAlbum(album.artist.name, album.name);
        if (!found) {
          await prisma.album.update({ where: { id: album.id }, data: { itunesFetchedAt: new Date() } });
          summary.missing++;
          continue;
        }

        const tracks = await this.catalog.lookupTracks(found.collectionId);
        const takeCover = !album.coverUrl && found.artworkUrl;

        await prisma.album.update({
          where: { id: album.id },
          data: {
            itunesCollectionId: found.collectionId,
            appleMusicUrl: found.appleMusicUrl,
            itunesGenre: found.genre,
            releaseYear: album.releaseYear ?? found.releaseYear,
            ...(takeCover
              ? { coverUrl: found.artworkUrl, coverSource: "itunes", coverEntityType: "release", coverFetchedAt: new Date() }
              : {}),
            itunesFetchedAt: new Date(),
          },
        });

        summary.matched++;
        summary.tracksUpdated += await this.applyCatalogTracks(userId, album.id, album.artistId, tracks);
      } catch (error) {
        // rede ou limite da Apple: o disco fica na fila para o próximo lote
        console.warn(`[EnrichmentService] Catalog lookup failed for "${album.name}".`, error);
      }
    }

    return summary;
  }

  /** Casa as faixas do disco no catálogo com as que você ouviu dele, pelo título. */
  private async applyCatalogTracks(userId: string, albumId: string, artistId: string, tracks: CatalogTrack[]): Promise<number> {
    if (tracks.length === 0) return 0;

    const heard = await prisma.track.findMany({
      where: { artistId, listeningEvents: { some: { albumId, userId } } },
      select: { id: true, name: true, durationMs: true, artist: { select: { name: true } } },
    });

    let updated = 0;
    for (const track of heard) {
      const match = tracks.find((candidate) => compatibleRecording(
        { artistName: track.artist.name, trackName: track.name },
        { artistName: candidate.artistName, trackName: candidate.name },
      ));
      if (!match) continue;

      await prisma.track.update({
        where: { id: track.id },
        data: {
          durationMs: track.durationMs ?? match.durationMs,
          previewUrl: match.previewUrl,
          itunesTrackId: match.trackId,
          appleMusicUrl: match.appleMusicUrl,
        },
      });
      updated++;
    }

    return updated;
  }

  /**
   * A primeira fonte de reserva que achar vence. Uma fonte fora do ar não
   * derruba as outras; só se todas falharem o erro sobe, e o álbum fica na
   * fila em vez de ser marcado como "sem capa" por engano.
   */
  private async findFallbackCover(artistName: string, albumName: string): Promise<CoverArtResult | null> {
    let failures = 0;

    for (const provider of this.fallbackCoverArt) {
      try {
        const cover = await provider.findAlbumCover(artistName, albumName);
        if (cover) return cover;
      } catch (error) {
        failures += 1;
        console.warn(`[EnrichmentService] Fallback cover source failed for "${albumName}".`, error);
      }
    }

    if (failures > 0 && failures === this.fallbackCoverArt.length) {
      throw new Error(`Every fallback cover source failed for "${albumName}".`);
    }
    return null;
  }

  private async getRecentEntityIds(userId: string, field: "artistId" | "albumId", take: number): Promise<string[]> {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const groups = await prisma.listeningEvent.groupBy({
      by: [field],
      where: { userId, playedAt: { gte: since }, [field]: { not: null } },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take,
    });
    return groups.map((group) => group[field]).filter((id): id is string => Boolean(id));
  }
}
