import { normalizeText } from "@/modules/listening/domain/normalization";
import { MetadataProvider, EnrichedArtistResult, EnrichedAlbumResult } from "../domain/metadata-provider.interface";

export class MusicBrainzAdapter implements MetadataProvider {
  private lastRequestTime = 0;
  private readonly minDelayMs = 1100;
  private readonly userAgent: string;

  constructor(userAgent = "SpotStats/0.1.0 ( contact@example.com )") {
    this.userAgent = userAgent;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minDelayMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  async searchArtist(artistName: string): Promise<EnrichedArtistResult | null> {
    if (!artistName || !artistName.trim()) return null;
    await this.throttle();

    const normalizedTarget = normalizeText(artistName);
    const url = `https://musicbrainz.org/ws/2/artist?query=artist:${encodeURIComponent(artistName)}&fmt=json`;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        console.warn(`[MusicBrainz] Artist search returned status ${response.status} for "${artistName}"`);
        return null;
      }

      const data = await response.json();
      const artists = data.artists || [];
      if (artists.length === 0) return null;

      let bestMatch: any = null;
      let highestConfidence = 0;

      for (const item of artists) {
        const itemNorm = normalizeText(item.name || "");
        let confidence = 0;

        if (itemNorm === normalizedTarget) {
          confidence = 1.0;
        } else if (itemNorm.includes(normalizedTarget) || normalizedTarget.includes(itemNorm)) {
          confidence = 0.8;
        } else {
          const mbScore = (item.score || 0) / 100;
          confidence = mbScore * 0.7;
        }

        if (confidence > highestConfidence) {
          highestConfidence = confidence;
          bestMatch = item;
        }
      }

      if (!bestMatch || highestConfidence < 0.6) {
        return null;
      }

      const country = bestMatch.country || bestMatch.area?.["iso-3166-1-codes"]?.[0] || null;
      const type = bestMatch.type || null;
      const disambiguation = bestMatch.disambiguation || null;
      const tags = (bestMatch.tags || [])
        .sort((a: any, b: any) => (b.count || 0) - (a.count || 0))
        .slice(0, 5)
        .map((t: any) => t.name.toLowerCase());

      return {
        mbid: bestMatch.id,
        name: bestMatch.name,
        country,
        type,
        disambiguation,
        tags,
        score: highestConfidence,
      };
    } catch (error) {
      console.error(`[MusicBrainz] Error searching artist "${artistName}":`, error);
      return null;
    }
  }

  async searchAlbum(albumName: string, artistMbid?: string): Promise<EnrichedAlbumResult | null> {
    if (!albumName || !albumName.trim()) return null;
    await this.throttle();

    let query = `release:${encodeURIComponent(albumName)}`;
    if (artistMbid) {
      query += `%20AND%20arid:${artistMbid}`;
    }
    const url = `https://musicbrainz.org/ws/2/release?query=${query}&fmt=json`;

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json",
        },
      });

      if (!response.ok) return null;

      const data = await response.json();
      const releases = data.releases || [];
      if (releases.length === 0) return null;

      const first = releases[0];
      const dateStr = first.date || first["release-events"]?.[0]?.date || "";
      const yearMatch = dateStr.match(/\b(19\d\d|20\d\d)\b/);
      const releaseYear = yearMatch ? parseInt(yearMatch[1], 10) : null;
      const primaryType = first["release-group"]?.["primary-type"] || first.status || null;

      return {
        mbid: first.id,
        releaseGroupMbid: first["release-group"]?.id || null,
        title: first.title,
        releaseYear,
        primaryType,
      };
    } catch (error) {
      console.error(`[MusicBrainz] Error searching album "${albumName}":`, error);
      return null;
    }
  }
}
