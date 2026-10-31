import { authorizeApi } from "@/lib/security/api-auth";
import { NextResponse } from "next/server";
import { SessionMediaService } from "@/modules/recommendations/application/session-media-service";
import { discoveryError } from "@/modules/recommendations/infrastructure/api-error";
export const maxDuration = 30;
export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const access = await authorizeApi(request);
  if (access.response) return access.response;
  const body = await request.json().catch(() => null);
  if (typeof body?.itemId !== "string" || body.itemId.length > 100) return NextResponse.json({ error: "Indicação inválida." }, { status: 400 });
  try {
    const result = await new SessionMediaService().resolve(access.userId, (await params).sessionId, body.itemId);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return discoveryError(error); }
}
