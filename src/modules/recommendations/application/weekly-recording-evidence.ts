import { z } from "zod";
import { MusicBrainzAdapter } from "@/modules/enrichment/infrastructure/musicbrainz-adapter";
import { normalizeText } from "@/modules/listening/domain/normalization";
import type { WeeklySelection } from "./weekly-selector";
import { weeklyCredit, type WeeklyAlbumEntry } from "../domain/weekly-journey";
import { catalogTrackURL } from "../domain/album-journey";

const credit = z.object({ type: z.string(), artist: z.object({ name: z.string() }).optional(), attributes: z.array(z.string()).optional() });
const artistCredit = z.object({ name: z.string() });
const recording = z.object({ id: z.string().uuid(), title: z.string(), length: z.number().nullable().optional(), disambiguation: z.string().optional(),
  relations: z.array(credit).optional(), "artist-credit": z.array(artistCredit).optional() });
const releaseSchema = z.object({
  id: z.string().uuid(), title: z.string(), "artist-credit": z.array(artistCredit).min(1),
  media: z.array(z.object({ position: z.number(), tracks: z.array(z.object({
    title: z.string(), position: z.number(), length: z.number().nullable().optional(), recording,
    "artist-credit": z.array(artistCredit).optional(),
  })) })),
});
const variants = /\b(live|ao vivo|remix|remaster(?:ed)?|acoustic|acustico|demo|edit|karaoke|instrumental|mono|stereo)\b/g;
const withoutFeatures = (value: string) => normalizeText(value).replace(/\s*\((?:feat\.?|featuring)\b[^)]*\)/g, "").trim();
const titleCore = (value: string) => withoutFeatures(value).replace(/\s*\[(?:live|ao vivo)\]\s*$/g, "")
  .replace(/\s*\((?:live|ao vivo)\)\s*$/g, "").trim();
const variantKeys = (value: string) => [...new Set((normalizeText(value).match(variants) ?? []).map((word) => word === "ao vivo" ? "live" : word))].sort().join("|");
const instrumentName = /^[\p{L}\p{N} ()'-]{1,70}$/u;

export function matchWeeklyRecordingCredits(entry: WeeklyAlbumEntry, payload: unknown, checkedAt: string): WeeklyAlbumEntry {
  const parsed = releaseSchema.safeParse(payload);
  if (!parsed.success) return entry;
  const { title, media, "artist-credit": artists } = parsed.data;
  if (normalizeText(title) !== normalizeText(entry.album.albumName) || artists.length !== 1
    || normalizeText(artists[0].name) !== normalizeText(entry.artistName)) return entry;
  const tracks = media.flatMap((disc) => disc.tracks.map((track) => ({ ...track, disc: disc.position })));
  if (tracks.length !== entry.tracks.length) return entry;
  const pairs = entry.tracks.map((track, index) => {
    const candidate = tracks[index];
    const duration = candidate.length ?? candidate.recording.length;
    return { track, candidate, delta: track.durationMs && duration ? Math.abs(track.durationMs - duration) : Infinity };
  });
  if (pairs.some(({ track, candidate, delta }) => {
    const artists = candidate["artist-credit"] ?? candidate.recording["artist-credit"] ?? parsed.data["artist-credit"];
    const expected = variantKeys(withoutFeatures(track.trackName));
    const observed = variantKeys(`${withoutFeatures(candidate.title)} ${candidate.recording.disambiguation ?? ""}`);
    // Establish the sequence first. Individual credits below require a tighter duration match.
    const sequenceTolerance = Math.min(10_000, Math.max(3000, (track.durationMs ?? 0) * .02));
    return candidate.disc !== track.disc || candidate.position !== track.number || titleCore(candidate.title) !== titleCore(track.trackName)
      || expected !== observed || normalizeText(artists[0]?.name ?? "") !== normalizeText(track.artistName)
      || delta > sequenceTolerance;
  })) return entry;

  const byTrack = tracks.map(({ recording }) => (recording.relations ?? []).flatMap((row) =>
    row.type === "instrument" && row.artist ? (row.attributes ?? []).filter((attribute) => instrumentName.test(attribute))
      .map((instrument) => ({ instrument, artist: row.artist!.name })) : []));
  const frequency = new Map<string, number>();
  for (const credits of byTrack) for (const instrument of new Set(credits.map((row) => row.instrument))) {
    frequency.set(instrument, (frequency.get(instrument) ?? 0) + 1);
  }
  return { ...entry, tracks: pairs.map(({ track, candidate, delta }, index) => {
    if (delta > 3000 || !catalogTrackURL(track.sourceUrl, track.trackId, entry.album.collectionId)) return track;
    const { id } = candidate.recording;
    const credit = byTrack[index].sort((a, b) => frequency.get(a.instrument)! - frequency.get(b.instrument)!)[0];
    const verified = weeklyCredit.safeParse({ provider: "musicbrainz", scope: "recording-credit", sourceId: id, url: `https://musicbrainz.org/recording/${id}`,
      artist: credit?.artist, instrument: credit?.instrument, fetchedAt: checkedAt });
    return verified.success ? { ...track, credit: verified.data } : track;
  }) };
}

const musicBrainz = new MusicBrainzAdapter();
type CreditSnapshot = { payload: unknown; fetchedAt: string; expiresAt: number };
const cached = new Map<string, CreditSnapshot>();
let pending: { id: string; task: Promise<CreditSnapshot | null> } | null = null;

async function publicCredits(id: string, timeoutMs: number): Promise<CreditSnapshot | null> {
  const value = cached.get(id);
  if (value && value.expiresAt > Date.now()) return value;
  if (pending) return pending.id === id ? pending.task : null;
  const task = musicBrainz.releaseWithRecordingCredits(id, timeoutMs).then((payload) => {
    const parsed = releaseSchema.safeParse(payload);
    if (!parsed.success) return null;
    const snapshot = { payload: parsed.data, fetchedAt: new Date().toISOString(), expiresAt: Date.now() + 86_400_000 };
    cached.delete(id);
    cached.set(id, snapshot);
    if (cached.size > 64) cached.delete(cached.keys().next().value!);
    return snapshot;
  });
  pending = { id, task };
  try { return await task; } finally { pending = null; }
}

export async function addWeeklyRecordingCredits(entries: WeeklySelection["entries"], deadline: number) {
  const first = entries.findIndex((row) => row.entry.kind === "ALBUM" && row.releaseId);
  const row = entries[first];
  const remaining = deadline - Date.now();
  if (row?.entry.kind !== "ALBUM" || !row.releaseId || remaining < 1500) return entries;
  const entry = row.entry;
  try {
    const data = await publicCredits(row.releaseId, Math.min(remaining - 1000, 4000));
    if (!data) return entries;
    const verified = matchWeeklyRecordingCredits(entry, data.payload, data.fetchedAt);
    return entries.map((value, index) => index === first ? { ...row, entry: verified } : value);
  } catch { return entries; }
}
