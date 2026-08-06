import { prisma } from "@/lib/db/prisma";
import { MusicBrainzAdapter } from "../infrastructure/musicbrainz-adapter";

export interface EnrichmentSummary {
  totalProcessed: number;
  resolved: number;
  failed: number;
  skipped: number;
  details: Array<{ name: string; status: "RESOLVED" | "FAILED" | "SKIPPED"; country?: string | null }>;
}

export interface EnrichmentCoverage {
  totalArtists: number;
  resolvedCount: number;
  failedCount: number;
  unresolvedCount: number;
  percentage: number;
}

export class EnrichmentService {
  constructor(private adapter = new MusicBrainzAdapter()) {}

  /**
   * Calculates overall metadata enrichment statistics for the user's artist library.
   */
  async getCoverageStats(): Promise<EnrichmentCoverage> {
    const totalArtists = await prisma.artist.count();
    if (totalArtists === 0) {
      return { totalArtists: 0, resolvedCount: 0, failedCount: 0, unresolvedCount: 0, percentage: 0 };
    }

    const resolvedCount = await prisma.artist.count({ where: { metadataStatus: "RESOLVED" } });
    const failedCount = await prisma.artist.count({ where: { metadataStatus: "FAILED" } });
    const unresolvedCount = totalArtists - (resolvedCount + failedCount);
    const percentage = Math.round((resolvedCount / totalArtists) * 100);

    return {
      totalArtists,
      resolvedCount,
      failedCount,
      unresolvedCount,
      percentage,
    };
  }

  /**
   * Batch enriches unresolved top artists using MusicBrainz API.
   */
  async enrichUnresolvedArtists(batchSize = 5): Promise<EnrichmentSummary> {
    // Priority: Select top artists with most listening events that are currently UNRESOLVED
    const unresolvedArtists = await prisma.artist.findMany({
      where: { metadataStatus: "UNRESOLVED" },
      take: batchSize,
      orderBy: {
        listeningEvents: {
          _count: "desc",
        },
      },
    });

    const summary: EnrichmentSummary = {
      totalProcessed: 0,
      resolved: 0,
      failed: 0,
      skipped: 0,
      details: [],
    };

    for (const artist of unresolvedArtists) {
      summary.totalProcessed++;

      try {
        const enriched = await this.adapter.searchArtist(artist.name);

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

          // Enrich top album if available
          const topAlbum = await prisma.album.findFirst({
            where: { artistId: artist.id, enrichedAt: null },
          });

          if (topAlbum) {
            const albumData = await this.adapter.searchAlbum(topAlbum.name, enriched.mbid);
            if (albumData) {
              await prisma.album.update({
                where: { id: topAlbum.id },
                data: {
                  mbid: albumData.mbid,
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
        console.error(`[EnrichmentService] Failed to enrich artist "${artist.name}":`, error);
        summary.failed++;
        summary.details.push({ name: artist.name, status: "FAILED" });
      }
    }

    return summary;
  }
}
