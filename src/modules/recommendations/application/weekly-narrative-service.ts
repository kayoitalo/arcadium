import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { reserveAttempt } from "@/modules/ai-analysis/application/ai-budget";
import { GeminiAdapter } from "@/modules/ai-analysis/infrastructure/gemini-adapter";
import { DiscoveryConflict } from "../domain/feedback";
import { weeklyNarrativeEnabled } from "../domain/weekly-journey";
import { prepareWeeklyNarrative, readWeeklyNarrative } from "../domain/weekly-narrative";
import { WeeklyJourneyService } from "./weekly-journey-service";

export class WeeklyNarrativeService {
  constructor(private gemini: Pick<GeminiAdapter, "chooseWeeklyNarrative"> = new GeminiAdapter()) {}

  async prepare(userId: string, id: string) {
    if (!weeklyNarrativeEnabled() || !process.env.GEMINI_API_KEY) throw new DiscoveryConflict("A apresentação experimental está indisponível.", 404);
    const journeys = new WeeklyJourneyService();
    const week = await journeys.byId(userId, id);
    if (!week || week.status !== "READY" || !week.entries.length) throw new DiscoveryConflict("Esta semana ainda está sendo preparada.", 409);
    const reserved = await prisma.weeklyJourney.updateMany({ where: { id, userId, status: "READY", narrativeStatus: null }, data: { narrativeStatus: "PREPARING" } });
    if (!reserved.count) return journeys.byId(userId, id);
    try {
      const result = await this.gemini.chooseWeeklyNarrative(prepareWeeklyNarrative(week.entries), {
        before: async (model) => (await reserveAttempt(userId, model)).id,
        after: async (id, outcome) => { await prisma.aIAnalysisRun.update({ where: { id }, data: { status: outcome.status, tokenCount: outcome.tokens ?? null } }); },
      });
      if (!readWeeklyNarrative(result, week.entries.map((entry) => entry.id))) throw new Error("Invalid narrative choices");
      await prisma.weeklyJourney.updateMany({ where: { id, userId, narrativeStatus: "PREPARING" },
        data: { narrativeStatus: "READY", narrative: result as Prisma.InputJsonValue } });
    } catch {
      await prisma.weeklyJourney.updateMany({ where: { id, userId, narrativeStatus: "PREPARING" }, data: { narrativeStatus: "FAILED" } });
    }
    return journeys.byId(userId, id);
  }
}
