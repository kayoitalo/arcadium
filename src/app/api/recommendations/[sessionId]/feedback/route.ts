import { authorizeApi } from "@/lib/security/api-auth";
import { NextResponse } from "next/server";
import { RecommendationService } from "@/modules/recommendations/application/recommendation-service";
import { feedbackRequest } from "@/modules/recommendations/domain/contracts";
import { discoveryError } from "@/modules/recommendations/infrastructure/api-error";
export const dynamic = "force-dynamic";
export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const access = await authorizeApi(request);
  if (access.response) return access.response;
  const body = feedbackRequest.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Feedback inválido." }, { status: 400 });
  const { itemId, type, note, ...options } = body.data;
  try {
    const { sessionId } = await params;
    const result = await new RecommendationService().submitFeedback(access.userId, itemId, type, note, sessionId, options);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return discoveryError(error); }
}
