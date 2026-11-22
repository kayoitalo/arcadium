import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/security/api-auth";
import { loadArtistTrail } from "@/modules/conversation/application/artist-trail";

export const dynamic = "force-dynamic";

/** A trilha do nome escolhido no retrato: ?artista=Pop Smoke. */
export async function GET(request: Request) {
  const access = await authorizeApi(request);
  if (access.response) return access.response;
  const artist = new URL(request.url).searchParams.get("artista")?.trim().slice(0, 300);
  if (!artist) return NextResponse.json({ error: "Faltou o nome." }, { status: 400 });
  try {
    return NextResponse.json(await loadArtistTrail(access.userId, artist), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não consegui seguir a trilha desse nome." }, { status: 503 });
  }
}
