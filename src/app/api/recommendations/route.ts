import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { RecommendationService } from "@/modules/recommendations/application/recommendation-service";
import type { RecommendationMode, RecommendationContext } from "@/modules/recommendations/domain/recommendation.types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await prisma.user.findFirst();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const service = new RecommendationService();
    const session = await service.getLatestSession(user.id);
    
    return NextResponse.json(session || { items: [] });
  } catch (error: any) {
    console.error("GET Recommendations API error:", error);
    return NextResponse.json({ error: error?.message || "Failed to load session" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await prisma.user.findFirst();
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await request.json();
    const mode = (body.mode as RecommendationMode) || "BALANCED";
    const context = (body.context as RecommendationContext) || "GENERAL";
    const period = body.period || "30d";

    const service = new RecommendationService();
    
    // First try to find an existing active session with the exact same mode and context
    // This prevents generating new sessions on simple page reloads
    const latest = await service.getLatestSession(user.id);
    if (latest && latest.mode === mode && latest.context === context) {
      return NextResponse.json(latest);
    }

    // Otherwise generate a new session
    const session = await service.generateSession({
      userId: user.id,
      mode,
      context,
      period,
      size: 8,
    });

    return NextResponse.json(session);
  } catch (error: any) {
    console.error("POST Recommendations API error:", error);
    return NextResponse.json({ error: error?.message || "Failed to generate recommendations" }, { status: 500 });
  }
}
