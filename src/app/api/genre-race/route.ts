import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/security/api-auth";
import { loadGenreRace } from "@/modules/statistics/application/genre-race";

export const dynamic = "force-dynamic";

/** A posição de cada gênero mês a mês, nos últimos seis meses: a pista do "o que mudou". */
export async function GET(request: Request) {
  const access = await authorizeApi(request);
  if (access.response) return access.response;
  try {
    return NextResponse.json(await loadGenreRace(access.userId), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não consegui montar a pista." }, { status: 503 });
  }
}
