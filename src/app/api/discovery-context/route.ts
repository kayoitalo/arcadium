import { z } from "zod";
import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/security/api-auth";
import { CulturalContextService } from "@/modules/recommendations/application/cultural-context-service";
import { contextKind } from "@/modules/recommendations/domain/cultural-context";
import { discoveryError } from "@/modules/recommendations/infrastructure/api-error";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  const access = await authorizeApi(request); if (access.response) return access.response;
  const body = z.object({ itemId: z.string().min(1).max(100), kind: contextKind }).strict().safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Escolha a faixa ou álbum desta indicação." }, { status: 400 });
  try {
    return NextResponse.json(await new CulturalContextService().load(access.userId, body.data.itemId, body.data.kind), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return discoveryError(error); }
}
