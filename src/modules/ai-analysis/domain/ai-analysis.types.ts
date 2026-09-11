

import { z } from "zod";

export interface MusicProfileInput {
  period: string;
  topArtists: Array<{
    name: string;
    plays: number;
    share: number;
    shareChange?: number | null;
  }>;
  topGenres: Array<{
    name: string;
    share: number;
  }>;
  risingArtists: Array<{
    name: string;
    plays: number;
    shareChange: number;
  }>;
  discovery: {
    newArtists: number;
    newArtistPlayShare: number;
  };
  concentration: {
    top5ArtistShare: number;
    top10TrackShare: number;
  };
  totalPlays: number;
  uniqueArtists: number;
  uniqueTracks: number;
  /** De que décadas saem os discos, como fração das audições com ano conhecido. */
  eras?: Array<{
    decade: string;
    share: number;
  }>;
}

export const profileNarrativeSchema = z.object({
  eyebrow: z.string().max(50).default("ANÁLISE DO PERÍODO"),
  headline: z.string().max(120),
  narrative: z.string().max(600),
  insight: z.string().max(300),
  playfulClosing: z.string().max(180).nullable().default(null),
  tone: z.enum(["EDITORIAL", "RELAXED", "PLAYFUL", "NOSTALGIC", "ANALYTICAL"]).default("RELAXED"),
  referencedEvidence: z.array(z.enum([
    "totalPlays", "uniqueArtists", "uniqueTracks", "topArtists", "topGenres",
    "risingArtists", "discovery", "concentration", "eras",
  ])).max(12).default([]),
  tasteKeywords: z.array(z.string()).max(5).optional(),
});

export type ProfileNarrative = z.infer<typeof profileNarrativeSchema>;

/** Telas que recebem uma frase curta do modelo. */
export const SCREEN_KEYS = ['evolution', 'discovery', 'history'] as const;
export type ScreenKey = (typeof SCREEN_KEYS)[number];

export const screenLinesSchema = z.object({
  lines: z
    .array(
      z.object({
        screen: z.enum(SCREEN_KEYS),
        line: z.string().min(8).max(180),
      })
    )
    .min(3)
    .max(10),
});

export type ScreenLines = z.infer<typeof screenLinesSchema>;

export const recommendationExplanationSchema = z.object({
  explanations: z.array(
    z.object({
      artistName: z.string(),
      trackName: z.string(),
      reason: z.string().max(300),
    })
  ),
});

export type RecommendationExplanation = z.infer<typeof recommendationExplanationSchema>;

export interface AIAnalysisProvider {
  analyzeProfile(input: MusicProfileInput): Promise<ProfileNarrative>;
  generateScreenLines(input: MusicProfileInput): Promise<ScreenLines>;
}
