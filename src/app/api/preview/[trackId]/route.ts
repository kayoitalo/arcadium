import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/security/api-auth";
import { prisma } from "@/lib/db/prisma";
import { ItunesPreviewAdapter } from "@/modules/recommendations/infrastructure/itunes-preview-adapter";

const previews = new ItunesPreviewAdapter();
export const maxDuration = 60;

/** Validate legacy catalog matches when played, without a lookup for every
 * album on the home page. Never redirect to an unverified stored preview URL.
 */
export async function GET(request: Request, context: { params: Promise<{ trackId: string }> }) {
  const access = await authorizeApi(request);
  if (access.response) return access.response;
  const { trackId } = await context.params;
  const track = await prisma.track.findFirst({
    where: { id: trackId, listeningEvents: { some: { userId: access.userId } } },
    select: { name: true, artist: { select: { name: true } } },
  });
  if (!track) return NextResponse.json({ error: "Faixa não encontrada." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  let preview;
  try { preview = await previews.findPreview(track.artist.name, track.name); }
  catch { return NextResponse.json({ error: "Prévia temporariamente indisponível." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
  if (!preview) return NextResponse.json({ error: "Prévia compatível indisponível." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.redirect(preview.url, { status: 307, headers: { "Cache-Control": "private, no-store" } });
}
