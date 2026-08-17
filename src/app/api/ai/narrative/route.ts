import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { AIAnalysisService } from "@/modules/ai-analysis/application/ai-analysis-service";
import { PeriodKey } from "@/modules/statistics/application/overview-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedPeriod = searchParams.get("period") || "30d";
    const supportedPeriods: PeriodKey[] = ["7d", "30d", "1y", "all"];
    if (!supportedPeriods.includes(requestedPeriod as PeriodKey)) {
      return NextResponse.json({ error: "Período inválido" }, { status: 400 });
    }
    const period = requestedPeriod as PeriodKey;

    // MVP Auth: Find first user
    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const aiService = new AIAnalysisService();
    const narrative = await aiService.getProfileNarrative(user.id, period);

    return NextResponse.json(narrative);
  } catch (error: any) {
    console.error("AI Narrative API error:", error);
    return NextResponse.json({ error: error?.message || "Failed to generate AI narrative" }, { status: 500 });
  }
}
