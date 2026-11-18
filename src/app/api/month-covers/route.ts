import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/security/api-auth";
import { loadMonthCovers } from "@/modules/statistics/application/month-covers";

export const dynamic = "force-dynamic";

/** O mês corrente dia a dia: quanto tocou e o disco de cada dia, para o calendário de capas. */
export async function GET(request: Request) {
  const access = await authorizeApi(request);
  if (access.response) return access.response;
  try {
    return NextResponse.json(await loadMonthCovers(access.userId), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Não consegui montar o mês." }, { status: 503 });
  }
}
