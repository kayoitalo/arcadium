import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/security/api-auth";
import { loadGenreRace } from "@/modules/statistics/application/genre-race";

export const dynamic = "force-dynamic";

/** A posição de cada gênero mês a mês, nos últimos seis meses: a pista do "o que mudou". */
export async function GET(request: Request) {
  const access = await authorizeApi(request);
  if (access.response) return access.response;
  try {
    // ?include=mangue beat,pop: os gêneros que a frase cita correm sempre
    const include = (new URL(request.url).searchParams.get("include") ?? "")
      .split(",").map((genre) => genre.trim().toLowerCase().slice(0, 60)).filter(Boolean).slice(0, 3);
    return NextResponse.json(await loadGenreRace(access.userId, new Date(), include), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não consegui montar a pista." }, { status: 503 });
  }
}
