import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/security/api-auth";
import { loadYearReview } from "@/modules/statistics/application/year-review";

export const dynamic = "force-dynamic";

/** O ano corrente em capítulos, cada um com a prova medida no banco. */
export async function GET(request: Request) {
  const access = await authorizeApi(request);
  if (access.response) return access.response;
  try {
    return NextResponse.json(await loadYearReview(access.userId), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não consegui juntar o teu ano." }, { status: 503 });
  }
}
