

import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { type PeriodKey } from "@/modules/statistics/application/overview-service";
import { ProfileBuilder } from "./profile-builder";
import { GeminiAdapter } from "../infrastructure/gemini-adapter";
import { profileNarrativeSchema, type ProfileNarrative } from "../domain/ai-analysis.types";

const NARRATIVE_PROMPT_VERSION = "v2-editorial";

export class AIAnalysisService {
  constructor(
    private profileBuilder = new ProfileBuilder(),
    private adapter = new GeminiAdapter()
  ) {}

  async getProfileNarrative(userId: string, period: PeriodKey): Promise<ProfileNarrative> {
    let pendingRunId: string | null = null;
    let profile: Awaited<ReturnType<ProfileBuilder["buildProfile"]>> | null = null;
    try {

      profile = await this.profileBuilder.buildProfile(userId, period);

      const inputString = JSON.stringify(profile);
      const inputHash = crypto.createHash("sha256").update(inputString).digest("hex");

      const cachedRun = await prisma.aIAnalysisRun.findFirst({
        where: {
          userId,
          kind: "PROFILE_NARRATIVE",
          inputHash,
          promptVersion: NARRATIVE_PROMPT_VERSION,
          status: "COMPLETED",
        },
        orderBy: { createdAt: "desc" },
      });

      if (cachedRun && cachedRun.validatedOutput) {
        const cachedNarrative = profileNarrativeSchema.safeParse(cachedRun.validatedOutput);
        if (cachedNarrative.success) return cachedNarrative.data;
      }

      if (!process.env.GEMINI_API_KEY) {
        return this.getFallbackNarrative(profile);
      }

      const run = await prisma.aIAnalysisRun.create({
        data: {
          userId,
          kind: "PROFILE_NARRATIVE",
          provider: "gemini",
          model: process.env.AI_MODEL || "gemini-3.5-flash",
          promptVersion: NARRATIVE_PROMPT_VERSION,
          inputHash,
          status: "PENDING",
        },
      });
      pendingRunId = run.id;

      const narrative = await this.adapter.analyzeProfile(profile);

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
      if (pendingRunId) {
        await prisma.aIAnalysisRun.update({
          where: { id: pendingRunId },
          data: { status: "FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Unknown AI provider error" },
        }).catch((auditError) => console.error("[AIAnalysisService] Failed to update AI audit run:", auditError));
      }
      return this.getFallbackNarrative(profile);
    }
  }

  private getFallbackNarrative(profile: any | null): ProfileNarrative {
    if (!profile) return {
      eyebrow: "ANÁLISE DO PERÍODO",
      headline: "Narrativa indisponível",
      narrative: "Não foi possível gerar a narrativa deste período.",
      insight: "As estatísticas determinísticas permanecem disponíveis no painel.",
      tasteKeywords: [],
      playfulClosing: null, tone: "ANALYTICAL", referencedEvidence: [],
    };

    const mainArtist = profile.topArtists[0]?.name;
    const plays = profile.totalPlays;
    if (!plays || !mainArtist) return {
      eyebrow: "ANÁLISE DO PERÍODO",
      headline: "Sem audições no período",
      narrative: "Não há eventos suficientes para gerar uma narrativa.",
      insight: "Selecione outro período ou sincronize o histórico do Last.fm.",
      tasteKeywords: [],
      playfulClosing: null, tone: "ANALYTICAL", referencedEvidence: ["totalPlays"],
    };

    const topGenre = profile.topGenres[0]?.name;
    return {
      eyebrow: "DESTAQUE DO PERÍODO",
      headline: `${mainArtist} foi o artista mais ouvido`,
      narrative: `O período contém ${plays} audições${topGenre ? `, com ${topGenre} entre as tags mais frequentes` : ""}.`,
      insight: "Texto determinístico gerado somente a partir dos dados armazenados.",
      tasteKeywords: profile.topGenres.slice(0, 3).map((genre: { name: string }) => genre.name),
      playfulClosing: null,
      tone: "ANALYTICAL",
      referencedEvidence: topGenre ? ["totalPlays", "topArtists", "topGenres"] : ["totalPlays", "topArtists"],
    };
  }
}
