import { EnrichmentService } from "@/modules/enrichment/application/enrichment-service";
import { NextResponse } from "next/server";

const enrichmentService = new EnrichmentService();

export async function GET() {
  try {
    const coverage = await enrichmentService.getCoverageStats();
    return NextResponse.json({ success: true, data: coverage });
  } catch (error: any) {
    console.error("GET /api/enrichment error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let batchSize = 5;
    let action: "all" | "covers" = "all";
    try {
      const body = await request.json();
      if (body.batchSize && typeof body.batchSize === "number") {
        batchSize = Math.min(20, Math.max(1, body.batchSize));
      }
      if (body.action === "covers") action = "covers";
    } catch {
      // Empty or invalid body, use default batchSize 5
    }

    if (action === "covers") {
      const covers = await enrichmentService.enrichMissingAlbumCovers(batchSize);
      const coverage = await enrichmentService.getCoverageStats();
      return NextResponse.json({ success: true, data: { covers, coverage } });
    }

    const summary = await enrichmentService.enrichUnresolvedArtists(batchSize);
    const updatedCoverage = await enrichmentService.getCoverageStats();

    return NextResponse.json({
      success: true,
      data: {
        summary,
        coverage: updatedCoverage,
      },
    });
  } catch (error: any) {
    console.error("POST /api/enrichment error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
