import { z } from "zod";
import type { Fact, FactsProvider, MusicProfileInput } from "../domain/ai-analysis.types";

const artistSchema = z.object({
  artist: z.object({ bio: z.object({ summary: z.string().optional() }).optional() }).optional(),
});

const albumSchema = z.object({
  album: z.object({ wiki: z.object({ summary: z.string().optional() }).optional() }).optional(),
});

/** Um fato por assunto, curto o bastante para virar gancho e não palestra. */
const MAX_FACT_CHARS = 420;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_SUBJECTS = 4;

export interface FactSubject {
  kind: Fact["kind"];
  artist: string;
  album?: string;
}

/**
 * O resumo da wiki do Last.fm vem com HTML e com o link "Read more on
 * Last.fm" no fim. Fica o texto limpo, cortado numa frase inteira.
 */
export function cleanWikiSummary(raw?: string | null): string | null {
  if (!raw) return null;
  const text = raw
    .replace(/<a\b[^>]*>.*?<\/a>/gis, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length < 40) return null;
  if (text.length <= MAX_FACT_CHARS) return text;

  const cut = text.slice(0, MAX_FACT_CHARS);
  const end = cut.lastIndexOf(". ");
  return end > 80 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
}

/**
 * Sobre quem vale buscar um fato: o disco mais ouvido, o artista do topo,
 * o ponto fora da curva e quem voltou — os assuntos que os ângulos usam.
 */
export function factSubjects(profile: MusicProfileInput): FactSubject[] {
  const subjects: FactSubject[] = [];
  const seen = new Set<string>();
  const add = (subject: FactSubject) => {
    const key = `${subject.kind}|${subject.artist.toLowerCase()}|${subject.album?.toLowerCase() ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    subjects.push(subject);
  };

  const album = profile.mostPlayed?.album;
  if (album) add({ kind: "disco", artist: album.artist, album: album.name });
  if (profile.topArtists[0]) add({ kind: "artista", artist: profile.topArtists[0].name });
  if (profile.outliers?.[0]) add({ kind: "artista", artist: profile.outliers[0].name });
  if (profile.comebacks?.[0]) add({ kind: "artista", artist: profile.comebacks[0].name });
  if (profile.mostPlayed?.track) add({ kind: "artista", artist: profile.mostPlayed.track.artist });

  return subjects.slice(0, MAX_SUBJECTS);
}

const cache = new Map<string, { value: Fact | null; expiresAt: number }>();

/**
 * Curiosidades vindas de fonte, não da memória do modelo: o resumo da wiki
 * do Last.fm, em português quando existe. O Gemini só pode contar
 * curiosidade que esteja aqui — um modelo não sabe quando está em dúvida,
 * então "na dúvida, não conte" não o impede de inventar.
 */
export class LastFmFactsAdapter implements FactsProvider {
  constructor(
    private apiKey = process.env.LASTFM_API_KEY || "",
    private userAgent = process.env.LASTFM_USER_AGENT || "Grooveyard/0.1",
  ) {}

  async collectFacts(profile: MusicProfileInput): Promise<Fact[]> {
    if (!this.apiKey) return [];
    const facts = await Promise.all(factSubjects(profile).map((subject) => this.factFor(subject)));
    return facts.filter((fact): fact is Fact => Boolean(fact));
  }

  private async factFor(subject: FactSubject): Promise<Fact | null> {
    const key = `${subject.kind}|${subject.artist}|${subject.album ?? ""}`.toLowerCase();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    let value: Fact | null = null;
    try {
      const params = new URLSearchParams({
        method: subject.kind === "disco" ? "album.getinfo" : "artist.getinfo",
        artist: subject.artist,
        ...(subject.album ? { album: subject.album } : {}),
        lang: "pt",
        autocorrect: "1",
        api_key: this.apiKey,
        format: "json",
      });
      const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`, {
        headers: { "User-Agent": this.userAgent },
        signal: AbortSignal.timeout(6_000),
      });

      if (response.ok) {
        const payload = await response.json();
        const summary =
          subject.kind === "disco"
            ? albumSchema.safeParse(payload).data?.album?.wiki?.summary
            : artistSchema.safeParse(payload).data?.artist?.bio?.summary;
        const text = cleanWikiSummary(summary);
        if (text) {
          value = {
            kind: subject.kind,
            about: subject.album ? `${subject.album} (${subject.artist})` : subject.artist,
            text,
          };
        }
      }
    } catch {
      // fato é bônus: sem ele, a graça vem dos outros mecanismos
    }

    cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
    return value;
  }
}
