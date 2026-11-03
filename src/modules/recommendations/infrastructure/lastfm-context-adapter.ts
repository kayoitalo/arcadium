import { z } from "zod";
import { recordingText, sameRecordingText } from "@/lib/music/recording-match";
import { cleanWikiSummary } from "@/modules/ai-analysis/infrastructure/lastfm-facts-adapter";
import { lastFmSourceURL, type ContextKind, type CulturalContext, type CulturalContextProvider } from "../domain/cultural-context";

const entry = z.object({ name: z.string(), artist: z.union([z.string(), z.object({ name: z.string() })]), url: z.string().optional(),
  wiki: z.object({ summary: z.string().optional() }).optional() });
const cache = new Map<string, { value?: CulturalContext; expires: number }>();
const pending = new Map<string, Promise<CulturalContext>>();
function remember(key: string, value: { value?: CulturalContext; expires: number }) {
  cache.delete(key); cache.set(key, value);
  while (cache.size > 100) cache.delete(cache.keys().next().value!);
}
export class LastFmContextAdapter implements CulturalContextProvider {
  constructor(private apiKey = process.env.LASTFM_API_KEY || "", private userAgent = process.env.LASTFM_USER_AGENT || "Arcadium/0.1") {}
  async lookup(kind: ContextKind, artistName: string, title: string): Promise<CulturalContext> {
    const base = { provider: "lastfm" as const, kind, artistName, title, fetchedAt: new Date().toISOString(), requestedLanguage: "pt" as const, recordingVerified: false as const };
    if (!this.apiKey) return { ...base, status: "MISSING", reason: "NOT_CONFIGURED" };
    const key = JSON.stringify([kind, recordingText(artistName), recordingText(title), "pt"]);
    const saved = cache.get(key);
    if (saved && saved.expires > Date.now()) { if (saved.value) return saved.value; throw new Error("Context provider cooling down"); }
    const running = pending.get(key); if (running) return running;
    const task = (async (): Promise<CulturalContext> => {
      try {
        const params = new URLSearchParams({ method: `${kind}.getInfo`, artist: artistName, [kind]: title, autocorrect: "0", lang: "pt", format: "json", api_key: this.apiKey });
        const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`, { headers: { "User-Agent": this.userAgent }, signal: AbortSignal.timeout(6000) });
        if (!response.ok) throw new Error("Context provider unavailable");
        const payload = await response.json();
        if (payload?.error && Number(payload.error) !== 6) throw new Error("Context provider unavailable");
        const parsed = entry.safeParse(payload?.[kind]);
        let value: CulturalContext = { ...base, status: "MISSING", reason: "NO_TEXT" };
        if (parsed.success) {
          const found = parsed.data;
          const artist = typeof found.artist === "string" ? found.artist : found.artist.name;
          if (!sameRecordingText(artistName, artist) || !sameRecordingText(title, found.name)) value = { ...base, status: "MISSING", reason: "IDENTITY_MISMATCH" };
          else {
            const text = cleanWikiSummary(found.wiki?.summary); const sourceUrl = lastFmSourceURL(found.url);
            if (text && sourceUrl) value = { ...base, status: "AVAILABLE", text, sourceUrl };
          }
        } else if (!payload?.error) throw new Error("Context provider returned invalid data");
        remember(key, { value, expires: Date.now() + (value.status === "AVAILABLE" ? 24 * 3600000 : 15 * 60000) });
        return value;
      } catch {
        remember(key, { expires: Date.now() + 30000 }); throw new Error("Context provider unavailable");
      }
    })();
    pending.set(key, task); try { return await task; } finally { pending.delete(key); }
  }
}
