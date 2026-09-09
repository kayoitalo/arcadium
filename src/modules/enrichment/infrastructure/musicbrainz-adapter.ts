import { normalizeText } from "@/modules/listening/domain/normalization";
import { MetadataProvider, EnrichedArtistResult, EnrichedAlbumResult } from "../domain/metadata-provider.interface";
import { ProviderUnavailableError } from "../domain/provider-errors";
import { filterGenreTags } from "../domain/genre-tags";

export class MusicBrainzAdapter implements MetadataProvider {
  private lastRequestTime = 0;
  private readonly minDelayMs: number;
  private readonly backoffBaseMs: number;
  private static readonly MAX_ATTEMPTS = 3;
  private readonly userAgent: string;

  /**
   * Os tempos são injetáveis porque a suíte de testes não pode ficar
   * esperando o intervalo real de 1 req/s exigido pelo MusicBrainz.
   */
  constructor(
    userAgent = process.env.MUSICBRAINZ_USER_AGENT || "Grooveyard/0.1 ( contato@example.com )",
    timing: { minDelayMs?: number; backoffBaseMs?: number } = {},
  ) {
    this.userAgent = userAgent;
    this.minDelayMs = timing.minDelayMs ?? 1100;
    this.backoffBaseMs = timing.backoffBaseMs ?? 1200;
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < this.minDelayMs) {
      await new Promise((resolve) => setTimeout(resolve, this.minDelayMs - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  /**
   * O MusicBrainz derruba conexões ociosas e responde 503 quando o
   * limite de 1 req/s é ultrapassado. Os dois casos são temporários e
   * merecem nova tentativa; o que não pode acontecer é virarem "não
   * encontrado", porque aí a entidade é aposentada como FAILED.
   */
  private async requestJson(url: string, entityName: string): Promise<any | null> {
    let lastCause: unknown;

    for (let attempt = 0; attempt < MusicBrainzAdapter.MAX_ATTEMPTS; attempt += 1) {
      await this.throttle();

      try {
        const response = await fetch(url, {
          headers: { "User-Agent": this.userAgent, Accept: "application/json" },
          signal: AbortSignal.timeout(12_000),
        });

        if (response.ok) return await response.json();

        // 404 é resposta legítima: a entidade não existe lá.
        if (response.status === 404) return null;

        if (response.status === 503 || response.status === 429 || response.status >= 500) {
          lastCause = new Error(`HTTP ${response.status}`);
          console.warn(
            `[MusicBrainz] HTTP ${response.status} em "${entityName}" (tentativa ${attempt + 1}/${MusicBrainzAdapter.MAX_ATTEMPTS})`
          );
          await this.backoff(attempt);
          continue;
        }

        console.warn(`[MusicBrainz] HTTP ${response.status} em "${entityName}"`);
        return null;
      } catch (error) {
        lastCause = error;
        console.warn(
          `[MusicBrainz] falha de rede em "${entityName}" (tentativa ${attempt + 1}/${MusicBrainzAdapter.MAX_ATTEMPTS})`
        );
        await this.backoff(attempt);
      }
    }

    throw new ProviderUnavailableError(entityName, lastCause);
  }

  private async backoff(attempt: number): Promise<void> {
    const wait = this.backoffBaseMs * 2 ** attempt + Math.random() * (this.backoffBaseMs / 3);
    await new Promise((resolve) => setTimeout(resolve, wait));
  }

  async searchArtist(artistName: string): Promise<EnrichedArtistResult | null> {
    if (!artistName || !artistName.trim()) return null;

    const normalizedTarget = normalizeText(artistName);
    const url = `https://musicbrainz.org/ws/2/artist?query=artist:${encodeURIComponent(artistName)}&fmt=json`;

    const data = await this.requestJson(url, artistName);
    if (!data) return null;

    {
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
      const tags = await this.resolveGenres(bestMatch);

      return {
        mbid: bestMatch.id,
        name: bestMatch.name,
        country,
        type,
        disambiguation,
        tags,
        score: highestConfidence,
      };
    }
  }

  /**
   * A busca só traz `tags`, que é folksonomia. Uma consulta extra pelo
   * MBID traz `genres`, que é a lista curada do MusicBrainz — é ela que
   * deve virar gênero na interface. As tags ficam só como plano B,
   * peneiradas, para artistas que ninguém classificou ainda.
   */
  private async resolveGenres(bestMatch: any): Promise<string[]> {
    const fallback = filterGenreTags(
      (bestMatch.tags || [])
        .sort((a: any, b: any) => (b.count || 0) - (a.count || 0))
        .map((tag: any) => String(tag.name || ""))
    ).slice(0, 5);

    try {
      const detail = await this.requestJson(
        `https://musicbrainz.org/ws/2/artist/${bestMatch.id}?inc=genres&fmt=json`,
        bestMatch.name || bestMatch.id
      );

      const curated = (detail?.genres || [])
        .sort((a: any, b: any) => (b.count || 0) - (a.count || 0))
        .map((genre: any) => String(genre.name || "").toLowerCase())
        .filter(Boolean)
        .slice(0, 5);

      return curated.length > 0 ? curated : fallback;
    } catch {
      // provedor fora no detalhe não invalida o que já achamos na busca
      return fallback;
    }
  }

  async searchAlbum(albumName: string, artistMbid?: string): Promise<EnrichedAlbumResult | null> {
    if (!albumName || !albumName.trim()) return null;

    let query = `release:${encodeURIComponent(albumName)}`;
    if (artistMbid) {
      query += `%20AND%20arid:${artistMbid}`;
    }
    const url = `https://musicbrainz.org/ws/2/release?query=${query}&fmt=json`;

    const data = await this.requestJson(url, albumName);
    if (!data) return null;

    {
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
    }
  }
}
