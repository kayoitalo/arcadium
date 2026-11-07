import { z } from "zod";
import { normalizeText } from "@/modules/listening/domain/normalization";
import { catalogURL, editionSummarySchema } from "./album-journey";
import { lastFmSourceURL } from "./cultural-context";

export const WEEKLY_VERSION = 1;
export const WEEKLY_ROLES = ["NEAR", "BRIDGE", "TERRITORY"] as const;
export const weeklyRole = z.enum(WEEKLY_ROLES);
export type WeeklyRole = z.infer<typeof weeklyRole>;
export const WEEKLY_TITLES: Record<WeeklyRole, string> = { NEAR: "Perto do teu gosto", BRIDGE: "Uma ponte", TERRITORY: "Outro universo" };

const day = 86_400_000;
export function weeklyWindow(now: Date, preferred: string | null) {
  const defaultZone = "America/Sao_Paulo";
  const formatter = (zone: string) => new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
  let timezone = preferred || defaultZone;
  let format: Intl.DateTimeFormat;
  try { format = formatter(timezone); } catch { timezone = defaultZone; format = formatter(timezone); }
  const calendar = (value: number) => {
    const parts = Object.fromEntries(format.formatToParts(value).map((part) => [part.type, part.value]));
    return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  };
  const today = calendar(now.getTime());
  const monday = today - (new Date(today).getUTCDay() + 6) % 7 * day;
  // Find the first instant of the local date, including zones with a midnight transition.
  const boundary = (date: number) => {
    let lo = date - 2 * day; let hi = date + 2 * day;
    while (lo < hi) {
      const middle = Math.floor((lo + hi) / 2);
      if (calendar(middle) < date) lo = middle + 1;
      else hi = middle;
    }
    return new Date(lo);
  };
  return { timezone, weekKey: new Date(monday).toISOString().slice(0, 10), startsAt: boundary(monday), endsAt: boundary(monday + 7 * day) };
}

const genreFamilies: Record<string, string> = {
  samba: "samba", mpb: "samba", "bossa nova": "samba",
  jazz: "jazz", "free jazz": "jazz", "spiritual jazz": "jazz", fusion: "jazz", bebop: "jazz",
  dub: "reggae", reggae: "reggae", ska: "reggae", dancehall: "reggae",
  rock: "rock", "alternative rock": "rock", "indie rock": "rock", punk: "rock", "punk rock": "rock", "hard rock": "rock",
  metal: "metal", "heavy metal": "metal", "black metal": "metal", "death metal": "metal",
  hiphop: "hip hop", "hip hop": "hip hop", rap: "hip hop", trap: "hip hop",
  electronic: "eletrônica", electronica: "eletrônica", house: "eletrônica", techno: "eletrônica", ambient: "eletrônica",
  pop: "pop", "indie pop": "pop", soul: "soul", funk: "soul", "r&b/soul": "soul", "r&b": "soul", blues: "blues",
  classical: "clássica", folk: "folk", country: "country", "country music": "country", "latin jazz": "jazz",
  latino: "latina", "latin music": "latina",
};
export function weeklyFamily(value: string) {
  return genreFamilies[normalizeText(value).replace(/-/g, " ")] ?? null;
}
export function weeklyAlbumKey(artist: string, album: string, releaseGroup?: string | null) {
  return releaseGroup ? `group:${releaseGroup}` : `album:${normalizeText(artist)}|${normalizeText(album)
    .replace(/\s*(?:\(|\[| - )[^()[\]]*(?:deluxe|expanded|remaster|anniversary|edicao especial)[^()[\]]*(?:\)|\]|$)/gi, "").trim()}`;
}

const name = z.string().trim().min(1).max(1000);
const safeApple = z.string().refine((url) => catalogURL(url) === url);
const safeMusicBrainz = z.string().regex(/^https:\/\/musicbrainz\.org\/recording\/[0-9a-f-]{36}$/);
const lastFmLink = z.string().refine((url) => lastFmSourceURL(url) === url);
export const weeklyCredit = z.object({
  provider: z.literal("musicbrainz"), scope: z.literal("recording-credit"),
  sourceId: z.string().uuid(), url: safeMusicBrainz, artist: name, instrument: z.string().min(1).max(120), fetchedAt: z.string().datetime(),
}).refine((value) => value.url === `https://musicbrainz.org/recording/${value.sourceId}`);
const editionTrack = z.object({
  trackId: z.string().regex(/^\d{1,20}$/), trackName: name, artistName: name,
  disc: z.number().int().min(1).max(8), number: z.number().int().min(1).max(80),
  durationMs: z.number().int().positive().nullable(), previewUrl: safeApple.nullable(), sourceUrl: safeApple.nullable(),
  credit: weeklyCredit.optional(),
});
const entry = {
  role: weeklyRole, artistName: name, style: name.nullable(), family: name.nullable(),
  reason: z.string().min(1).max(400),
  reference: z.object({ provider: z.enum(["catalog", "history", "lastfm"]), url: lastFmLink.nullable() }),
};
export const weeklyEntrySchema = z.discriminatedUnion("kind", [
  z.object({ ...entry, kind: z.literal("ALBUM"), album: editionSummarySchema, tracks: z.array(editionTrack).min(1).max(80) }),
  z.object({ ...entry, kind: z.literal("ARTIST"), trackSource: z.enum(["lastfm", "catalog"]),
    tracks: z.array(z.object({ trackName: name, artistName: name })).min(1).max(3),
  }),
]).superRefine((entry, ctx) => {
  if (entry.kind !== "ALBUM") return;
  const { tracks, album } = entry;
  let disc = 1; let number = 1;
  const complete = tracks.length === album.trackCount && new Set(tracks.map((track) => track.trackId)).size === tracks.length && tracks.every((track, index) => {
    if (index > 0 && track.disc === disc + 1) { disc++; number = 1; }
    return track.disc === disc && track.number === number++;
  });
  if (!complete) ctx.addIssue({ code: "custom", message: "A edição semanal precisa da sequência completa." });
});
export type WeeklyEntry = z.infer<typeof weeklyEntrySchema>;
export type WeeklyAlbumEntry = Extract<WeeklyEntry, { kind: "ALBUM" }>;
export type WeeklyCredit = z.infer<typeof weeklyCredit>;

export type WeeklyNarrative = { opening: string; transitions: Record<string, string> };
export type WeeklyView = {
  id: string; weekKey: string; timezone: string; startsAt: string; endsAt: string;
  status: "PREPARING" | "READY" | "EMPTY" | "FAILED"; personalized: boolean; limited: boolean;
  narrative?: WeeklyNarrative; narrativeStatus?: string | null;
  entries: Array<{ id: string; position: number; role: WeeklyRole; kind: WeeklyEntry["kind"]; artistName: string; style: string | null; reason: string;
    reference: WeeklyEntry["reference"]; sessionId: string | null; exposedAt: string | null; trackCount: number;
    album?: z.infer<typeof editionSummarySchema>; tracks?: string[]; trackSource?: "lastfm" | "catalog" }>;
};

export function weeklyEnabled() {
  const value = process.env.ARCADIUM_WEEKLY_ENABLED;
  return value === "1" || (value !== "0" && (process.env.VERCEL_ENV === "preview" || process.env.APP_ENV === "preview" || process.env.NODE_ENV !== "production"));
}
export function weeklyNarrativeEnabled() { return process.env.ARCADIUM_WEEKLY_NARRATIVE === "1"; }
