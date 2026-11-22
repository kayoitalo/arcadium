import type { UserProfile as LegacyProfile } from "./legacy-scoring";
import type { FeedbackType } from "./recommendation.types";
import { trackFeedbackKey } from "./feedback";

export interface TasteSlice {
  artists: Array<{ name: string; plays: number; share: number; genres?: string[] }>;
  genres: Array<{ name: string; share: number }>;
  tracks: TrackSeed[];
  totalPlays: number;
  genreCoverage: number;
}
export interface TrackSeed { artistName: string; trackName: string; plays: number; lastPlayedAt?: string; region: "long_term" | "recent" | "feedback" | "loved" | "saved" }
export interface UserProfile extends LegacyProfile {
  /** A session request, not an inferred or persisted musical preference. */
  explicitReference?: { artistName: string; trackName: string };
  longTerm?: TasteSlice;
  recent?: TasteSlice;
  trackSeeds?: TrackSeed[];
  likedTracks?: Array<{ artistName: string; trackName: string }>;
  referenceTime?: string;
}
export const PROFILE_WEIGHTS = { longTerm: 0.7, recent: 0.3 } as const;

export function tasteSlice(
  artists: Array<{ name: string; plays: number }>, tracks: TrackSeed[], genres: Map<string, string[]>,
): TasteSlice {
  const totalPlays = artists.reduce((sum, artist) => sum + Math.max(0, artist.plays), 0);
  const totals = new Map<string, number>();
  let covered = 0;
  for (const artist of artists) {
    const tags = [...new Set(genres.get(artist.name.toLowerCase()) ?? [])];
    if (!tags.length) continue;
    covered += artist.plays;
    for (const tag of tags) totals.set(tag, (totals.get(tag) ?? 0) + artist.plays / tags.length);
  }
  return { totalPlays, genreCoverage: totalPlays ? covered / totalPlays : 0, artists: artists.map((artist) => ({ ...artist, share: totalPlays ? artist.plays / totalPlays : 0, genres: genres.get(artist.name.toLowerCase()) ?? [] }))
    .sort((a, b) => b.plays - a.plays || a.name.localeCompare(b.name)),
    genres: [...totals].map(([name, plays]) => ({ name, share: covered ? plays / covered : 0 }))
      .sort((a, b) => b.share - a.share || a.name.localeCompare(b.name)), tracks };
}

/** Uma faixa que a pessoa declarou gostar fora daqui: o ♥ do Last.fm ou uma Curtida do Spotify. */
export interface DeclaredSeed { artistName: string; trackName: string; region?: "loved" | "saved" }

/** Quantas das mais recentes de cada fonte entram no rodízio. */
const RECENT_DECLARED = 20;

/**
 * O ♥ do Last.fm e as Curtidas do Spotify numa fila só, alternando — as
 * duas dividem uma vaga de semente, pra fase recente e o repertório de
 * sempre não perderem a deles. Das Curtidas, as que quase não tocaram
 * (menos de 5 vezes no histórico) vêm primeiro: as muito tocadas já estão
 * nas outras regiões. Cada dia a fila começa de um ponto diferente.
 */
export function declaredSeeds(loved: Array<{ artistName: string; trackName: string }>, saved: Array<{ artistName: string; trackName: string }>,
  plays: (artistName: string, trackName: string) => number, now = new Date()): DeclaredSeed[] {
  const day = Math.floor(now.getTime() / 86_400_000);
  const rotate = <T>(items: T[]) => {
    const pool = items.slice(0, RECENT_DECLARED);
    const start = pool.length ? day % pool.length : 0;
    return [...pool.slice(start), ...pool.slice(0, start)];
  };
  const quiet = saved.filter((track) => plays(track.artistName, track.trackName) < 5);
  const loud = saved.filter((track) => plays(track.artistName, track.trackName) >= 5);
  const a = rotate(loved).map((track) => ({ ...track, region: "loved" as const }));
  const b = rotate([...quiet, ...loud]).map((track) => ({ ...track, region: "saved" as const }));
  return Array.from({ length: Math.max(a.length, b.length) }, (_, index): Array<DeclaredSeed | undefined> => [a[index], b[index]]).flat().filter((track): track is DeclaredSeed => Boolean(track));
}

/**
 * As faixas de partida do Descobrir, uma de cada região por vez: o "curti"
 * daqui, o que a pessoa declarou gostar fora (♥ do Last.fm, Curtidas do
 * Spotify), a fase recente e o repertório de sempre.
 */
export function representativeTracks(longTerm: TasteSlice, recent: TasteSlice,
  liked: Array<{ artistName: string; trackName: string }>, feedback: Map<string, FeedbackType>, limit = 4,
  loved: DeclaredSeed[] = []): TrackSeed[] {
  const pools: TrackSeed[][] = [liked.map((track) => ({ ...track, plays: 0, region: "feedback" })),
    loved.map((track) => ({ artistName: track.artistName, trackName: track.trackName, plays: 0, region: track.region ?? "loved" })),
    [...recent.tracks].sort((a, b) => b.plays - a.plays), [...longTerm.tracks].sort((a, b) => b.plays - a.plays)];
  const selected: TrackSeed[] = [];
  const keys = new Set<string>();
  const artists = new Set<string>();
  // First pass takes different artists from each region; second can fill a sparse profile.
  for (const distinct of [true, false]) {
    for (let offset = 0; offset < limit && selected.length < limit; offset++) {
      for (const pool of pools) {
        const track = pool.filter((item) => feedback.get(trackFeedbackKey(item.artistName, item.trackName)) !== "DISLIKED"
          && !keys.has(trackFeedbackKey(item.artistName, item.trackName)) && (!distinct || !artists.has(item.artistName.toLowerCase())))[0];
        if (!track || selected.length >= limit) continue;
        selected.push(track); keys.add(trackFeedbackKey(track.artistName, track.trackName)); artists.add(track.artistName.toLowerCase());
      }
    }
  }
  return selected;
}

export function representativeArtists(profile: UserProfile, limit = 3): Array<{ name: string; region: "long_term" | "recent" | "feedback" }> {
  const pools = [
    (profile.recent?.artists ?? []).map((item) => ({ name: item.name, region: "recent" as const })),
    (profile.longTerm?.artists ?? profile.topArtistNames.map((name) => ({ name }))).map((item) => ({ name: item.name, region: "long_term" as const })),
  ];
  const result: ReturnType<typeof representativeArtists> = [];
  const used = new Set<string>();
  const usedGenres = new Set<string>();
  const genres = new Map([...(profile.longTerm?.artists ?? []), ...(profile.recent?.artists ?? [])].map((artist) => [artist.name.toLowerCase(), artist.genres ?? []]));
  for (let i = 0; i < limit; i++) for (const pool of pools) {
    const choices = pool.filter((item) => !used.has(item.name.toLowerCase()));
    const next = choices.find((item) => genres.get(item.name.toLowerCase())?.some((genre) => !usedGenres.has(genre))) ?? choices[0];
    if (next && result.length < limit) { result.push(next); used.add(next.name.toLowerCase());
      for (const genre of genres.get(next.name.toLowerCase()) ?? []) usedGenres.add(genre);
    }
  }
  return result;
}
