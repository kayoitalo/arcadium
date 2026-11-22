import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/security/api-auth";
import { loadGenreMovers } from "@/modules/statistics/application/genre-movers";

export const dynamic = "force-dynamic";

const clean = (value: string | null) => (value ? value.trim().toLowerCase().slice(0, 60) || null : null);

/** Quem puxou a mudança: ?period=30d&rising=mangue beat&falling=pop. */
export async function GET(request: Request) {
  const access = await authorizeApi(request);
  if (access.response) return access.response;
  const params = new URL(request.url).searchParams;
  const period = params.get("period") === "1y" ? "1y" : "30d";
  try {
    return NextResponse.json(await loadGenreMovers(access.userId, period, clean(params.get("rising")), clean(params.get("falling"))), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não consegui achar quem puxou a mudança." }, { status: 503 });
  }
}
