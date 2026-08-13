/**
 * AI Analysis Service
 *
 * Blueprint §11: Orchestrates the AI analysis pipeline.
 * - Builds profile using ProfileBuilder
 * - Generates hash to prevent duplicate calls and save costs
 * - Calls AI provider (Gemini)
 * - Persists run for audit/caching
 * - Returns deterministic fallback on failure
 */

import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { type PeriodKey } from "@/modules/statistics/application/overview-service";
import { ProfileBuilder } from "./profile-builder";
import { GeminiAdapter } from "../infrastructure/gemini-adapter";
import type { ProfileNarrative } from "../domain/ai-analysis.types";

export class AIAnalysisService {
  constructor(
    private profileBuilder = new ProfileBuilder(),
    private adapter = new GeminiAdapter()
  ) {}

  /**
   * Generates or retrieves a cached AI narrative for the user's dashboard.
   */
  async getProfileNarrative(userId: string, period: PeriodKey): Promise<ProfileNarrative> {
    try {
      // 1. Build the deterministic profile
      const profile = await this.profileBuilder.buildProfile(userId, period);

      // 2. Hash the input to reuse identical analyses
      const inputString = JSON.stringify(profile);
      const inputHash = crypto.createHash("sha256").update(inputString).digest("hex");

      // 3. Check for existing successful run with this exact input
      const cachedRun = await prisma.aIAnalysisRun.findFirst({
        where: {
          userId,
          kind: "PROFILE_NARRATIVE",
          inputHash,
          status: "COMPLETED",
        },
        orderBy: { createdAt: "desc" },
      });

      if (cachedRun && cachedRun.validatedOutput) {
        return cachedRun.validatedOutput as ProfileNarrative;
      }

      // If no AI key is provided, we must use the deterministic fallback immediately
      // without trying and failing (and polluting the DB with FAILED runs).
      if (!process.env.GEMINI_API_KEY) {
        return this.getFallbackNarrative(profile);
      }

      // 4. Create a pending run audit
      const run = await prisma.aIAnalysisRun.create({
        data: {
          userId,
          kind: "PROFILE_NARRATIVE",
          provider: "gemini",
          model: process.env.AI_MODEL || "gemini-2.0-flash",
          promptVersion: "v1",
          inputHash,
          status: "PENDING",
        },
      });

      // 5. Call the AI
      const narrative = await this.adapter.analyzeProfile(profile);

      // 6. Update run with success
      await prisma.aIAnalysisRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          validatedOutput: narrative as any,
        },
      });

      return narrative;
    } catch (error: any) {
      console.error("[AIAnalysisService] Narrative generation failed:", error);

      // We could mark the run as FAILED here if we passed the run ID down,
      // but the simplest robust pattern is to just return the fallback.
      
      return this.getFallbackNarrative(null);
    }
  }

  /**
   * Deterministic fallback when AI is unavailable or fails.
   * Blueprint §11.4: Fallback to deterministic templated explanations.
   */
  private getFallbackNarrative(profile: any | null): ProfileNarrative {
    if (!profile) {
      return {
        headline: "Seu perfil musical",
        narrative: "Continue ouvindo para descobrir novos padrões na sua biblioteca musical.",
        insight: "Análise inteligente temporariamente indisponível.",
        tasteKeywords: ["Exploração"],
      };
    }

    const mainArtist = profile.topArtists[0]?.name || "Seus artistas favoritos";
    const plays = profile.totalPlays;
    
    return {
      headline: `Ouvindo com frequência: ${mainArtist}`,
      narrative: `Neste período, você registrou ${plays} faixas. Seu perfil mostra forte tendência para ${profile.topGenres[0]?.name || "gêneros variados"}.`,
      insight: `${mainArtist} dominou suas escutas recentemente.`,
      tasteKeywords: profile.topGenres.slice(0, 3).map((g: any) => g.name),
    };
  }
}
