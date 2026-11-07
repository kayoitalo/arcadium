import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApi } from "@/lib/security/api-auth";
import { WeeklyJourneyService } from "@/modules/recommendations/application/weekly-journey-service";
import { WeeklyNarrativeService } from "@/modules/recommendations/application/weekly-narrative-service";
import { weeklyEnabled } from "@/modules/recommendations/domain/weekly-journey";
import { discoveryError } from "@/modules/recommendations/infrastructure/api-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("PREPARE") }).strict(),
  z.object({ action: z.literal("START"), entryId: z.uuid() }).strict(),
  z.object({ action: z.literal("EXPOSE"), entryId: z.uuid() }).strict(),
  z.object({ action: z.literal("NARRATE"), journeyId: z.uuid() }).strict(),
]);

export async function GET(request: Request) {
  const access = await authorizeApi(request); if (access.response) return access.response;
  const params = new URL(request.url).searchParams;
  const query = z.object({ id: z.uuid().optional(), history: z.literal("1").optional(), before: z.uuid().optional() }).safeParse({
    id: params.get("id") ?? undefined, history: params.get("history") ?? undefined, before: params.get("before") ?? undefined,
  });
  if (!query.success) return NextResponse.json({ error: "Jornada semanal inválida." }, { status: 400, headers });
  try {
    const service = new WeeklyJourneyService();
    const { id, history, before } = query.data;
    if (id) return NextResponse.json({ current: await service.byId(access.userId, id), previous: null, canPrepare: false }, { headers });
    if (history) return NextResponse.json(await service.history(access.userId, before), { headers });
    return NextResponse.json(await service.current(access.userId), { headers });
  } catch (error) { return discoveryError(error); }
}

export async function POST(request: Request) {
  const access = await authorizeApi(request); if (access.response) return access.response;
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escolha uma ação da jornada semanal." }, { status: 400, headers });
  const input = parsed.data;
  try {
    const service = new WeeklyJourneyService();
    if (input.action === "PREPARE") {
      if (!weeklyEnabled()) return NextResponse.json({ error: "A jornada semanal está indisponível." }, { status: 404, headers });
      return NextResponse.json(await service.prepare(access.userId), { headers });
    }
    if (input.action === "NARRATE") return NextResponse.json(await new WeeklyNarrativeService().prepare(access.userId, input.journeyId), { headers });
    if (input.action === "EXPOSE") return NextResponse.json(await service.expose(access.userId, input.entryId), { headers });
    return NextResponse.json(await service.start(access.userId, input.entryId), { headers });
  } catch (error) { return discoveryError(error); }
}
