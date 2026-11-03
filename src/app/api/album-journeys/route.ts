import { z } from "zod";
import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/security/api-auth";
import { AlbumJourneyService } from "@/modules/recommendations/application/album-journey-service";
import { albumSourceSchema } from "@/modules/recommendations/domain/album-journey";
import { discoveryError } from "@/modules/recommendations/infrastructure/api-error";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("EDITIONS"), source: albumSourceSchema }).strict(),
  z.object({ action: z.literal("BEGIN"), source: albumSourceSchema, collectionId: z.string().regex(/^\d{1,20}$/), requestKey: z.uuid() }).strict(),
]);
export async function GET(request: Request) {
  const access = await authorizeApi(request); if (access.response) return access.response;
  const params = new URL(request.url).searchParams;
  const query = z.object({ q: z.string().trim().max(120).default(""), item: z.string().min(1).max(100).optional() }).safeParse({ q: params.get("q") ?? "", item: params.get("item") ?? undefined });
  if (!query.success) return NextResponse.json({ error: "Busca inválida." }, { status: 400, headers });
  try {
    const service = new AlbumJourneyService();
    const data = query.data.item ? { albums: [{ source: { kind: "recommendation", id: query.data.item }, ...await service.source(access.userId, { kind: "recommendation", id: query.data.item }) }], more: false }
      : await service.library(access.userId, query.data.q);
    return NextResponse.json(data, { headers });
  } catch (error) { return discoveryError(error); }
}
export async function POST(request: Request) {
  const access = await authorizeApi(request); if (access.response) return access.response;
  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Escolha um álbum e uma edição válidos." }, { status: 400, headers });
  try {
    const service = new AlbumJourneyService(); const input = body.data;
    return NextResponse.json(input.action === "EDITIONS" ? await service.editions(access.userId, input.source)
      : await service.begin(access.userId, input.source, input.collectionId, input.requestKey), { headers });
  } catch (error) { return discoveryError(error); }
}
