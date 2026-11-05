import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/security/api-auth";
import { discoveryError } from "@/modules/recommendations/infrastructure/api-error";
import { TerritoryService } from "@/modules/recommendations/application/territory-service";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const access = await authorizeApi(request); if (access.response) return access.response;
  try { return NextResponse.json(await new TerritoryService().doors(), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return discoveryError(error); }
}
