import { z } from "zod";
import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/security/api-auth";
import { prisma } from "@/lib/db/prisma";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  const access = await authorizeApi(request); if (access.response) return access.response;
  const parsed = z.object({ itemId: z.string().min(1).max(100), requestKey: z.uuid() }).strict().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Evento inválido." }, { status: 400, headers });
  try {
    const item = await prisma.recommendationItem.findFirst({ where: { id: parsed.data.itemId, session: { userId: access.userId } }, select: { id: true, previewUrl: true } });
    if (!item?.previewUrl) return NextResponse.json({ error: "Prévia não encontrada nesta conta." }, { status: 404, headers });
    const previous = await prisma.discoveryEvent.findUnique({ where: { userId_requestKey: { userId: access.userId, requestKey: parsed.data.requestKey } } });
    if (previous && previous.itemId !== item.id) return NextResponse.json({ error: "A chave já pertence a outra prévia." }, { status: 409, headers });
    const saved = await prisma.discoveryEvent.upsert({ where: { userId_requestKey: { userId: access.userId, requestKey: parsed.data.requestKey } },
      create: { userId: access.userId, itemId: item.id, requestKey: parsed.data.requestKey }, update: {}, select: { itemId: true } });
    if (saved.itemId !== item.id) return NextResponse.json({ error: "A chave já pertence a outra prévia." }, { status: 409, headers });
    return NextResponse.json({ success: true }, { headers });
  } catch { return NextResponse.json({ error: "Não consegui registrar o início da prévia." }, { status: 503, headers }); }
}
