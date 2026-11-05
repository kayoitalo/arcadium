import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/security/api-auth";
import { DiscoveryMemoryService } from "@/modules/recommendations/application/discovery-memory-service";
import { memoryQuery } from "@/modules/recommendations/domain/discovery-memory";
import { discoveryError } from "@/modules/recommendations/infrastructure/api-error";
import { privateDownloadFailure } from "@/lib/http/private-download";
export async function GET(request: Request) {
  const access = await authorizeApi(request); if (access.response) return privateDownloadFailure(request, access.response);
  const params = new URL(request.url).searchParams;
  const headers: Record<string, string> = { "Cache-Control": "private, no-store" };
  try {
    const service = new DiscoveryMemoryService();
    if (params.get("summary") === "1") return NextResponse.json(await service.summary(access.userId), { headers });
    const query = memoryQuery.safeParse(Object.fromEntries(["q", "responses", "cursor"].flatMap((key) => params.has(key) ? [[key, params.get(key)]] : [])));
    if (!query.success) return NextResponse.json({ error: "Filtro de memória inválido." }, { status: 400, headers });
    const page = await service.list(access.userId, query.data);
    if (params.get("download") === "1") {
      headers["Content-Disposition"] = 'attachment; filename="arcadium-memoria-recorte.json"';
      return NextResponse.json({ exportedAt: new Date().toISOString(), scope: "filtered-page", filters: query.data, ...page }, { headers });
    }
    return NextResponse.json(page, { headers });
  } catch (error) { return discoveryError(error); }
}
