import { authorizeApi } from "@/lib/security/api-auth";
import { NextResponse } from "next/server";
import { RecommendationService } from "@/modules/recommendations/application/recommendation-service";
import { sessionRequest } from "@/modules/recommendations/domain/contracts";
import { discoveryError } from "@/modules/recommendations/infrastructure/api-error";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request) {
  const access = await authorizeApi(request);
  if (access.response) return access.response;
  try {
    const session = await new RecommendationService().getLatestSession(access.userId);
    return NextResponse.json(session || { items: [] }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return discoveryError(error); }
}
export async function POST(request: Request) {
  const access = await authorizeApi(request);
  if (access.response) return access.response;
  const body = sessionRequest.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Pedido de descoberta inválido." }, { status: 400 });
  const { proximity, fame, ...input } = body.data;
  try {
    const session = await new RecommendationService().generateSession({
      ...input, userId: access.userId, size: 8,
      dials: proximity !== undefined && fame !== undefined ? { proximity, fame } : undefined,
    });
    return NextResponse.json(session, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return discoveryError(error); }
}
