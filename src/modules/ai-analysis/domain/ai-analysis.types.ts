/**
 * AI Analysis — Domain Types
 *
 * Blueprint §11.1: Compact MusicProfileInput from stored statistics.
 * Blueprint §11.2: AI responsibilities — describe, explain, narrate.
 * Blueprint §11.3: AI prohibitions — no calculation, no Spotify, no IDs.
 */

import { z } from "zod";

/**
 * Structured input sent to AI — pseudonymized, no credentials, no raw timeline.
 * Blueprint §11.1
 */
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
}

/**
 * Validated AI output — profile narrative.
 * Blueprint §11.4: Zod validation on AI output.
 */
export const profileNarrativeSchema = z.object({
  eyebrow: z.string().max(50).default("ANÁLISE DO PERÍODO"),
  headline: z.string().max(120),
  narrative: z.string().max(600),
  insight: z.string().max(300),
  playfulClosing: z.string().max(180).nullable().default(null),
  tone: z.enum(["EDITORIAL", "RELAXED", "PLAYFUL", "NOSTALGIC", "ANALYTICAL"]).default("RELAXED"),
  referencedEvidence: z.array(z.enum([
    "totalPlays", "uniqueArtists", "uniqueTracks", "topArtists", "topGenres",
    "risingArtists", "discovery", "concentration",
  ])).max(12).default([]),
  tasteKeywords: z.array(z.string()).max(5).optional(),
});

export type ProfileNarrative = z.infer<typeof profileNarrativeSchema>;

/**
 * Validated AI output — recommendation explanation.
 */
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

/**
 * AI provider interface — allows swapping Gemini for another provider.
 * Blueprint §11.4, Decision 9: AI provider is configuration.
 */
export interface AIAnalysisProvider {
  analyzeProfile(input: MusicProfileInput): Promise<ProfileNarrative>;
}
