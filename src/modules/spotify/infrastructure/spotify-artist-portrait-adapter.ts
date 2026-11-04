import { z } from "zod";
import { sameRecordingText } from "@/lib/music/recording-match";
import { artistPhotoSchema, portraitImageURL, spotifyArtistIdSchema, type ArtistPhotoResult, type ArtistPortraitProvider, type ArtistPortraitReference } from "@/modules/enrichment/domain/artist-portrait";
import { assertSpotifyAvailable, spotifyFetch, SpotifyUnavailable } from "./spotify-http";
import { invalidateSpotifyCatalogToken, isSpotifyCatalogConfigured, spotifyCatalogToken } from "./spotify-catalog-token";

const artistRefSchema = z.object({ id: spotifyArtistIdSchema, name: z.string() });
const searchSchema = z.object({ tracks: z.object({ items: z.array(z.object({ name: z.string(), artists: z.array(artistRefSchema).max(100) })).max(10), next: z.string().nullable() }) });
const profileSchema = artistRefSchema.extend({ images: z.array(z.object({ url: z.string(), width: z.number().nullable(), height: z.number().nullable() })).max(20) });
const cache = new Map<string, { value?: ArtistPhotoResult; expires: number }>();
const pending = new Map<string, Promise<ArtistPhotoResult>>();
let active = false;
let lastRequest = 0;
function remember(key: string, value: { value?: ArtistPhotoResult; expires: number }) {
  cache.delete(key); cache.set(key, value);
  while (cache.size > 64) cache.delete(cache.keys().next().value!);
}

export class SpotifyArtistPortraitAdapter implements ArtistPortraitProvider {
  constructor(private interval = 1100) {}
  async lookup(reference: ArtistPortraitReference): Promise<ArtistPhotoResult> {
    if (!reference.artistName.trim() || !reference.trackName.trim()) return { status: "MISSING", reason: "NO_REFERENCE" };
    if (!isSpotifyCatalogConfigured()) return { status: "MISSING", reason: "NOT_CONFIGURED" };
    const key = JSON.stringify([reference.artistName, reference.trackName]);
    const saved = cache.get(key);
    if (saved && saved.expires > Date.now()) {
      if (saved.value) return saved.value;
      throw new SpotifyUnavailable();
    }
    const running = pending.get(key); if (running) return running;
    assertSpotifyAvailable();
    if (active) throw new SpotifyUnavailable();
    active = true;
    const task = this.load(reference).then(value => {
      remember(key, { value, expires: Date.now() + (value.status === "READY" ? 86400000 : 3600000) }); return value;
    }).catch(error => { remember(key, { expires: Date.now() + 30000 }); throw error; });
    pending.set(key, task);
    try { return await task; } finally { active = false; pending.delete(key); }
  }
  private async request(path: string, token: string) {
    const delay = lastRequest + this.interval - Date.now();
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    lastRequest = Date.now();
    const response = await spotifyFetch(`https://api.spotify.com/v1/${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(6000), redirect: "error",
    });
    if (response.status === 401) invalidateSpotifyCatalogToken();
    if (!response.ok) throw new SpotifyUnavailable();
    return response.json();
  }
  private async load(reference: ArtistPortraitReference): Promise<ArtistPhotoResult> {
    // Quotes/newlines would alter the search filter. No broad-name fallback.
    if (/["\\\r\n]/.test(reference.artistName + reference.trackName)) return { status: "MISSING", reason: "NO_MATCH" };
    const token = await spotifyCatalogToken();
    const query = new URLSearchParams({ q: `artist:"${reference.artistName}" track:"${reference.trackName}"`, type: "track", market: "BR", limit: "10" });
    const found = searchSchema.safeParse(await this.request(`search?${query}`, token));
    if (!found.success) throw new SpotifyUnavailable();
    const matches = new Map<string, string>();
    for (const track of found.data.tracks.items) {
      if (!sameRecordingText(reference.trackName, track.name)) continue;
      for (const artist of track.artists) if (sameRecordingText(reference.artistName, artist.name)) matches.set(artist.id, artist.name);
    }
    if (!matches.size) return { status: "MISSING", reason: "NO_MATCH" };
    if (matches.size !== 1) return { status: "MISSING", reason: "AMBIGUOUS" };
    const [artistId] = matches.keys();
    const profile = profileSchema.safeParse(await this.request(`artists/${artistId}`, token));
    if (!profile.success) throw new SpotifyUnavailable();
    if (profile.data.id !== artistId || !sameRecordingText(reference.artistName, profile.data.name)) return { status: "MISSING", reason: "AMBIGUOUS" };
    const image = profile.data.images.filter(image => portraitImageURL(image.url)).sort((a, b) => (a.width ?? 0) - (b.width ?? 0));
    const chosen = image.find(image => (image.width ?? 0) >= 640) ?? image.at(-1);
    if (!chosen) return { status: "MISSING", reason: "NO_IMAGE" };
    return artistPhotoSchema.parse({ status: "READY", provider: "spotify", artistId, artistName: profile.data.name,
      imageUrl: chosen.url, sourceUrl: `https://open.spotify.com/artist/${artistId}`, checkedAt: new Date().toISOString() });
  }
}
