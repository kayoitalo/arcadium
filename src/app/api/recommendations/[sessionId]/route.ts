import { authorizeApi } from "@/lib/security/api-auth";
import { NextResponse } from "next/server";
import { RecommendationService } from "@/modules/recommendations/application/recommendation-service";
import { SessionMemoryService } from "@/modules/recommendations/application/session-memory-service";
import { progressRequest } from "@/modules/recommendations/domain/contracts";
import { discoveryError } from "@/modules/recommendations/infrastructure/api-error";
type Context = { params: Promise<{ sessionId: string }> };
export async function GET(request: Request, { params }: Context) {
  const access = await authorizeApi(request);
  if (access.response) return access.response;
  try {
    const result = await new RecommendationService().getSession((await params).sessionId, access.userId);
    return NextResponse.json(result ?? { error: "Sessão não encontrada." }, { status: result ? 200 : 404, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return discoveryError(error); }
}
export async function PATCH(request: Request, { params }: Context) {
  const access = await authorizeApi(request);
  if (access.response) return access.response;
  const body = progressRequest.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Progresso inválido." }, { status: 400 });
  try {
    const { sessionId } = await params;
    const service = new SessionMemoryService();
    const value = body.data;
    const result = value.operation === "EXPOSE" ? await service.expose(access.userId, sessionId, value.itemId)
      : await service.move(access.userId, sessionId, value.rank, value.expectedRank);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return discoveryError(error); }
}
