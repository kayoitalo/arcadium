

import crypto from "crypto";
import { prisma } from "@/lib/db/prisma";
import { type PeriodKey } from "@/modules/statistics/application/overview-service";
import { ProfileBuilder } from "./profile-builder";
import { readBudget } from "./ai-budget";
import { GeminiAdapter } from "../infrastructure/gemini-adapter";
import {
  profileNarrativeSchema,
  screenLinesSchema,
  SCREEN_KEYS,
  type ProfileNarrative,
  type ScreenKey,
  type ScreenLines,
} from "../domain/ai-analysis.types";

const NARRATIVE_PROMPT_VERSION = "v5-eras";

/**
 * O hash do perfil muda a cada audição nova, então sozinho ele nunca
 * acerta o cache — com sync de hora em hora, toda visita gastaria uma
 * chamada. Esta janela reaproveita o último texto do mesmo período.
 */
const NARRATIVE_TTL_HOURS = 12;

/** As legendas das telas vêm de um lote só, gerado no máximo uma vez por dia. */
const SCREEN_LINES_KIND = "SCREEN_LINES";
const SCREEN_LINES_TTL_HOURS = 24;

/** Sem IA o app não fica mudo: frases fixas, honestas e sem inventar dado. */
const FALLBACK_SCREEN_LINES = {
  lines: [
    { screen: "evolution" as ScreenKey, line: "O que entrou e o que saiu de moda no seu fone." },
    { screen: "evolution" as ScreenKey, line: "Comparação direta entre este período e o anterior." },
    { screen: "discovery" as ScreenKey, line: "Nomes novos, escolhidos a partir do que você já ouve." },
    { screen: "discovery" as ScreenKey, line: "Cada sugestão vem com o motivo de estar aqui." },
    { screen: "history" as ScreenKey, line: "Tudo o que tocou, do mais recente para trás." },
    { screen: "history" as ScreenKey, line: "Sua escuta em ordem cronológica, dia a dia." },
  ],
};

/** Escopo por período, aproveitando o índice [userId, kind, createdAt]. */
function narrativeKind(period: PeriodKey): string {
  return `PROFILE_NARRATIVE:${period}`;
}

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
          kind: narrativeKind(period),
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

      // mesmo com o perfil mexido, um texto recente do mesmo período serve
      const recent = await this.findLastNarrative(userId, period, NARRATIVE_TTL_HOURS);
      if (recent) return recent;

      if (!process.env.GEMINI_API_KEY) {
        return this.getFallbackNarrative(profile);
      }

      // o TTL cuida do frescor; o teto cuida do custo
      const budget = await readBudget(userId);
      if (!budget.allowed) {
        console.warn(
          `[AIAnalysisService] Teto de IA atingido (${budget.blockedBy === "hour" ? "hora" : "dia"}): ` +
          `${budget.usedToday}/${budget.dailyLimit} hoje, ${budget.usedThisHour}/${budget.hourlyLimit} nesta hora.`
        );
        const lastGood = await this.findLastNarrative(userId, period);
        return lastGood ?? this.getFallbackNarrative(profile);
      }

      const run = await prisma.aIAnalysisRun.create({
        data: {
          userId,
          kind: narrativeKind(period),
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
      const lastGood = await this.findLastNarrative(userId, period);
      return lastGood ?? this.getFallbackNarrative(profile);
    }
  }

  /**
   * Um lote de frases para as telas secundárias. Uma chamada por dia; a
   * interface sorteia qual mostrar a cada visita. Sem chave, sem provedor
   * ou sem cota, devolve o conjunto determinístico.
   */
  async getScreenLines(userId: string): Promise<ScreenLines> {
    const cached = await this.findLastScreenLines(userId, SCREEN_LINES_TTL_HOURS);
    if (cached) return cached;

    if (!process.env.GEMINI_API_KEY) return FALLBACK_SCREEN_LINES;

    const budget = await readBudget(userId);
    if (!budget.allowed) {
      const lastGood = await this.findLastScreenLines(userId);
      return lastGood ?? FALLBACK_SCREEN_LINES;
    }

    // a linha nasce PENDENTE antes da chamada: tentativa que falha também
    // gasta cota, e o teto precisa enxergar isso
    const run = await prisma.aIAnalysisRun.create({
      data: {
        userId,
        kind: SCREEN_LINES_KIND,
        provider: "gemini",
        model: process.env.AI_MODEL || "gemini-3.5-flash",
        promptVersion: NARRATIVE_PROMPT_VERSION,
        status: "PENDING",
      },
    });

    try {
      const profile = await this.profileBuilder.buildProfile(userId, "30d");
      const lines = await this.adapter.generateScreenLines(profile);

      await prisma.aIAnalysisRun.update({
        where: { id: run.id },
        data: { status: "COMPLETED", validatedOutput: lines as any },
      });

      return lines;
    } catch (error) {
      console.error("[AIAnalysisService] Screen lines generation failed:", error);
      await prisma.aIAnalysisRun.update({
        where: { id: run.id },
        data: { status: "FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "erro" },
      }).catch(() => null);
      const lastGood = await this.findLastScreenLines(userId);
      return lastGood ?? FALLBACK_SCREEN_LINES;
    }
  }

  private async findLastScreenLines(userId: string, withinHours?: number): Promise<ScreenLines | null> {
    const run = await prisma.aIAnalysisRun.findFirst({
      where: {
        userId,
        kind: SCREEN_LINES_KIND,
        promptVersion: NARRATIVE_PROMPT_VERSION,
        status: "COMPLETED",
        ...(withinHours
          ? { createdAt: { gte: new Date(Date.now() - withinHours * 60 * 60 * 1000) } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    if (!run?.validatedOutput) return null;
    const parsed = screenLinesSchema.safeParse(run.validatedOutput);
    return parsed.success ? parsed.data : null;
  }

  /**
   * O último texto validado deste período. Com `withinHours` funciona
   * como cache; sem, é a rede de segurança para quando o provedor cai ou
   * a cota do dia acaba — melhor um texto de ontem do que nenhum.
   */
  private async findLastNarrative(
    userId: string,
    period: PeriodKey,
    withinHours?: number
  ): Promise<ProfileNarrative | null> {
    const run = await prisma.aIAnalysisRun.findFirst({
      where: {
        userId,
        kind: narrativeKind(period),
        promptVersion: NARRATIVE_PROMPT_VERSION,
        status: "COMPLETED",
        ...(withinHours
          ? { createdAt: { gte: new Date(Date.now() - withinHours * 60 * 60 * 1000) } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    if (!run?.validatedOutput) return null;
    const parsed = profileNarrativeSchema.safeParse(run.validatedOutput);
    return parsed.success ? parsed.data : null;
  }

  /**
   * Sem chave de IA ou com o provedor fora do ar, o texto ainda precisa
   * soar como alguém falando. Continua 100% determinístico: cada frase
   * é escolhida pelos próprios números, nada é inventado.
   */
  private getFallbackNarrative(profile: any | null): ProfileNarrative {
    const emptyState: ProfileNarrative = {
      eyebrow: "Sem leitura deste período",
      headline: "Silêncio por aqui",
      narrative: "Nada tocou nesse intervalo, ou o histórico ainda não chegou até aqui.",
      insight: "Escolha um intervalo maior para ver o quadro completo.",
      tasteKeywords: [],
      playfulClosing: null,
      tone: "ANALYTICAL",
      referencedEvidence: [],
    };

    if (!profile) return emptyState;

    const mainArtist = profile.topArtists[0]?.name;
    const plays = profile.totalPlays;
    if (!plays || !mainArtist) return { ...emptyState, referencedEvidence: ["totalPlays"] };

    const topGenre = profile.topGenres[0]?.name;
    const artists = profile.uniqueArtists ?? 0;
    const share = Math.round((profile.topArtists[0]?.share ?? 0) * 100);
    // o ProfileBuilder entrega fração (0.17), não porcentagem
    const top5 = Math.round((profile.concentration?.top5ArtistShare ?? 0) * 100);

    const headline =
      share >= 20
        ? `${mainArtist} não deixou espaço para mais ninguém`
        : share >= 10
          ? `${mainArtist} liderou, mas sem folga`
          : `Nenhum nome dominou — ${mainArtist} só ficou na frente`;

    const narrative = topGenre
      ? `${mainArtist} ficou no topo entre ${artists} artistas, puxando ${topGenre} junto.`
      : `${mainArtist} ficou no topo entre ${artists} artistas diferentes.`;

    const insight =
      top5 >= 50
        ? `Metade da sua escuta cabe em cinco nomes — ${top5}%, para ser exato.`
        : `Os cinco primeiros somam ${top5}%: o resto ficou bem espalhado.`;

    return {
      eyebrow: "Destaque do período",
      headline,
      narrative,
      insight,
      tasteKeywords: profile.topGenres.slice(0, 3).map((genre: { name: string }) => genre.name),
      playfulClosing: null,
      tone: "ANALYTICAL",
      referencedEvidence: topGenre
        ? ["totalPlays", "topArtists", "topGenres", "concentration"]
        : ["totalPlays", "topArtists", "concentration"],
    };
  }
}
