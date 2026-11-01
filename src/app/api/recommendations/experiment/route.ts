import { NextResponse } from "next/server";
import { z } from "zod";
import { authorizeApi } from "@/lib/security/api-auth";
import { RecommendationService } from "@/modules/recommendations/application/recommendation-service";
import { ListenBrainzExperiment } from "@/modules/recommendations/infrastructure/listenbrainz-experiment";
import { recordingText } from "@/lib/music/recording-match";
export const maxDuration = 20;
const requestSchema = z.object({ recordingMbid: z.string().uuid(), baselineSessionId: z.string().min(1).max(100) });
export async function POST(request: Request) {
  const access = await authorizeApi(request);
  if (access.response) return access.response;
  if (process.env.ARCADIUM_LISTENBRAINZ_EXPERIMENT !== "true") return NextResponse.json({ error: "Experimento desativado." }, { status: 404 });
  const body = requestSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Informe uma gravação MusicBrainz e uma sessão de referência." }, { status: 400 });
  try {
    const baseline = await new RecommendationService().getSession(body.data.baselineSessionId, access.userId);
    if (!baseline) return NextResponse.json({ error: "Sessão não encontrada." }, { status: 404 });
    const key = (artist: string, track: string) => JSON.stringify([recordingText(artist), recordingText(track)]);
    const keys = new Set(baseline.items.map((item) => key(item.artistName, item.trackName)));
    const candidates = await new ListenBrainzExperiment().candidates(body.data.recordingMbid);
    return NextResponse.json({ baselineSessionId: baseline.sessionId, baselineAlgorithm: baseline.algorithmVersion,
      candidates: candidates.map((item) => ({ ...item, textOverlapWithBaseline: keys.has(key(item.artistName, item.trackName)) })),
      comparison: { total: candidates.length, textOverlap: candidates.filter((item) => keys.has(key(item.artistName, item.trackName))).length,
        limitation: "Comparação textual com a sessão, não confirmação de gravação nem medida de qualidade." } },
      { headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Experimento indisponível temporariamente." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
