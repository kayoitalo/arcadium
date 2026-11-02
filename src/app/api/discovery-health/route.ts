import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/security/api-auth";
import { prisma } from "@/lib/db/prisma";
import { readBudget } from "@/modules/ai-analysis/application/ai-budget";
export async function GET(request: Request) {
  const access = await authorizeApi(request); if (access.response) return access.response;
  const since = new Date(Date.now() - 7 * 86400000); const userId = access.userId;
  try {
    const [sessions, responses, attempts, budget] = await Promise.all([
      prisma.recommendationSession.groupBy({ by: ["status"], where: { userId, createdAt: { gte: since } }, _count: { id: true } }),
      prisma.recommendationFeedback.groupBy({ by: ["type"], where: { userId, createdAt: { gte: since } }, _count: { id: true } }),
      prisma.aIAnalysisRun.groupBy({ by: ["model", "status", "kind"], where: { userId, createdAt: { gte: since }, provider: { not: "gemini-pack" } }, _count: { id: true, tokenCount: true }, _sum: { tokenCount: true } }),
      readBudget(userId),
    ]);
    return NextResponse.json({ since, sessions, responses, attempts, budget }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Não consegui reunir os registros de funcionamento." }, { status: 503 }); }
}
