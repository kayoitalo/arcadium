import { after, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { AIAnalysisService } from "@/modules/ai-analysis/application/ai-analysis-service";
import { logAi } from "@/modules/ai-analysis/application/ai-log";
import type { PeriodKey } from "@/modules/statistics/application/overview-service";

export const dynamic = "force-dynamic";

/**
 * Só a primeira visita de um período sem pacote espera a geração; no resto
 * a resposta é imediata e a renovação roda depois dela (after).
 */
export const maxDuration = 180;

const PERIODS: PeriodKey[] = ["7d", "30d", "1y", "all"];

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("period") ?? "30d";
  if (!PERIODS.includes(requested as PeriodKey)) {
    return NextResponse.json({ error: "Período inválido" }, { status: 400 });
  }
  const period = requested as PeriodKey;

  try {
    const user = await prisma.user.findFirst({ select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const service = new AIAnalysisService();
    const view = await service.getPack(user.id, period, (task) =>
      after(async () => {
        await task().catch((error) =>
          logAi("ai.background_failed", { kind: `PACK:${period}`, message: String(error).slice(0, 200) }, "error"),
        );
      }),
    );

    return NextResponse.json(view);
  } catch (error) {
    logAi("ai.route_failed", { route: "pack", period, message: String(error).slice(0, 200) }, "error");
    return NextResponse.json({ error: "Não foi possível montar os textos." }, { status: 500 });
  }
}
