import { CoverArtProvider, CoverArtResult } from "../domain/cover-art-provider.interface";

const MBID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class CoverArtArchiveAdapter implements CoverArtProvider {
  constructor(private userAgent = process.env.MUSICBRAINZ_USER_AGENT || "MusicIntelligence/0.1 (contact@example.com)") {}

  async findFrontCover(releaseMbid: string): Promise<CoverArtResult | null> {
    return this.findCover("release", releaseMbid);
  }

  async findReleaseGroupFrontCover(releaseGroupMbid: string): Promise<CoverArtResult | null> {
    return this.findCover("release-group", releaseGroupMbid);
  }

  private async findCover(entityType: "release" | "release-group", mbid: string): Promise<CoverArtResult | null> {
    if (!MBID_PATTERN.test(mbid)) return null;

    const url = `https://coverartarchive.org/${entityType}/${encodeURIComponent(mbid)}/front-500`;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: { "User-Agent": this.userAgent },

          redirect: "manual",
          signal: AbortSignal.timeout(6_000),
        });
        if (response.status === 404 || response.status === 400) return null;
        const redirectedUrl = response.headers?.get("location");
        const result = { url: redirectedUrl || url, source: "cover-art-archive", entityType, mbid } as const;
        if (response.status >= 300 && response.status < 400) {
          if (!redirectedUrl) return result;
          const imageResponse = await fetch(redirectedUrl, { method: "GET", headers: { "User-Agent": this.userAgent, Range: "bytes=0-0" }, signal: AbortSignal.timeout(5_000) });
          if (imageResponse.ok || imageResponse.status === 206) return result;
          return null;
        }
        if (response.ok) return result;

        const transient = response.status === 429 || response.status >= 500;
        if (transient && attempt < 2) continue;
        throw new Error(`Cover Art Archive returned HTTP ${response.status}`);
      } catch (error) {
        if (attempt < 2) continue;
        console.error(`[CoverArtArchive] Failed ${entityType} ${mbid}:`, error);
        throw error;
      }
    }

    return null;
  }
}
