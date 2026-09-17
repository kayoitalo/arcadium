import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyCronAuth } from "@/lib/security/cron-auth";
import { AIAnalysisService } from "@/modules/ai-analysis/application/ai-analysis-service";
import { logAi } from "@/modules/ai-analysis/application/ai-log";

export const dynamic = "force-dynamic";

/** Gera no máximo um pacote por chamada, mas uma resposta longa do modelo leva tempo. */
export const maxDuration = 180;

/**
 * Chamada pelo cron logo depois do sync de hora em hora: renova o pacote
 * de textos que mais precisar — um por execução, no ritmo de cada período.
 */
export async function POST(request: Request) {
  const auth = verifyCronAuth(request);
  if (!auth.authorized) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const user = await prisma.user.findFirst({ select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const report = await new AIAnalysisService().refreshStalest(user.id);
    logAi("ai.refresh_run", { report });
    return NextResponse.json({ report });
  } catch (error) {
    logAi("ai.route_failed", { route: "refresh", message: String(error).slice(0, 200) }, "error");
    return NextResponse.json({ error: "A renovação dos textos falhou." }, { status: 500 });
  }
}
