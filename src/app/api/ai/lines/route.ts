import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { AIAnalysisService } from "@/modules/ai-analysis/application/ai-analysis-service";

const service = new AIAnalysisService();

export async function GET() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) return NextResponse.json({ lines: [] });

    return NextResponse.json(await service.getScreenLines(user.id));
  } catch (error) {
    console.error("GET /api/ai/lines error:", error);
    // a legenda é enfeite: falhar aqui não pode derrubar a tela
    return NextResponse.json({ lines: [] });
  }
}
