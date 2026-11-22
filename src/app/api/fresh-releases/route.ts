import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/security/api-auth";
import { loadFreshReleases } from "@/modules/listening/application/fresh-releases";

export const dynamic = "force-dynamic";

/** O que saiu nas últimas duas semanas de quem a pessoa ouve, pelo feed do ListenBrainz. */
export async function GET(request: Request) {
  const access = await authorizeApi(request);
  if (access.response) return access.response;
  const releases = await loadFreshReleases(access.userId).catch(() => []);
  return NextResponse.json({ releases }, { headers: { "Cache-Control": "private, max-age=600" } });
}
