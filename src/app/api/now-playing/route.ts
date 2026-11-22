import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/security/api-auth";
import { loadNowPlaying } from "@/modules/listening/application/now-playing";

export const dynamic = "force-dynamic";

/** O que está tocando agora no Last.fm: { playing: null } quando nada toca. */
export async function GET(request: Request) {
  const access = await authorizeApi(request);
  if (access.response) return access.response;
  return NextResponse.json({ playing: await loadNowPlaying(access.userId) }, { headers: { "Cache-Control": "private, no-store" } });
}
