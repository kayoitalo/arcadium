import { z } from "zod";
import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/security/api-auth";
import { CollectionService } from "@/modules/recommendations/application/collection-service";
import { discoveryError } from "@/modules/recommendations/infrastructure/api-error";
import { privateDownloadFailure } from "@/lib/http/private-download";

const headers = { "Cache-Control": "private, no-store" };
const name = z.string().min(1).max(1000).refine((value) => Boolean(value.trim()), "Nome vazio");
const item = z.object({ id: z.string().min(1).max(200), artistName: name,
  trackName: name, action: z.enum(["liked", "saved"]) }).strict();
export async function GET(request: Request) {
  const access = await authorizeApi(request); if (access.response) return privateDownloadFailure(request, access.response);
  try {
    const items = await new CollectionService().list(access.userId);
    if (new URL(request.url).searchParams.get("download") === "1") return NextResponse.json({ exportedAt: new Date().toISOString(), items },
      { headers: { ...headers, "Content-Disposition": 'attachment; filename="arcadium-colecao.json"' } });
    return NextResponse.json({ items }, { headers });
  }
  catch (error) { return discoveryError(error); }
}
export async function POST(request: Request) {
  const access = await authorizeApi(request); if (access.response) return access.response;
  const parsed = z.object({ items: z.array(item).max(200) }).strict().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Lista local inválida." }, { status: 400, headers });
  try { return NextResponse.json(await new CollectionService().importLocal(access.userId, parsed.data.items), { headers }); }
  catch (error) { return discoveryError(error); }
}
export async function DELETE(request: Request) {
  const access = await authorizeApi(request); if (access.response) return access.response;
  const parsed = item.pick({ artistName: true, trackName: true }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Faixa inválida." }, { status: 400, headers });
  try { await new CollectionService().remove(access.userId, parsed.data); return NextResponse.json({ success: true }, { headers }); }
  catch (error) { return discoveryError(error); }
}
