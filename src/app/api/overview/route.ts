import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createEmptyOverview, OverviewService, PeriodKey } from "@/modules/statistics/application/overview-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "30d") as PeriodKey;

    const user = await prisma.user.findFirst();
    if (!user) {
      return NextResponse.json(createEmptyOverview(period));
    }

    const overviewService = new OverviewService();
    const data = await overviewService.getOverviewData(user.id, period);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Overview API error:", error);
    return NextResponse.json({ error: error?.message || "Failed to load overview data" }, { status: 500 });
  }
}
