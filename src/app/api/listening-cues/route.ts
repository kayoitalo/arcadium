import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApi } from "@/lib/security/api-auth";
import { discoveryError } from "@/modules/recommendations/infrastructure/api-error";
import { ListeningCuesService } from "@/modules/recommendations/application/listening-cues-service";
export async function POST(request: Request) {
  const access = await authorizeApi(request); if (access.response) return access.response;
  const body = z.object({ itemId: z.string().min(1).max(100) }).strict().safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Escolha a indicação." }, { status: 400 });
  try { return NextResponse.json(await new ListeningCuesService().load(access.userId, body.data.itemId), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return discoveryError(error); }
}
