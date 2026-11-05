import { z } from "zod";
import { NextResponse } from "next/server";
import { authorizeApi } from "@/lib/security/api-auth";
import { prisma } from "@/lib/db/prisma";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  const access = await authorizeApi(request); if (access.response) return access.response;
  try { return NextResponse.json({ topics: await prisma.editorialMemory.findMany({ where: { userId: access.userId, dismissed: true }, orderBy: { createdAt: "desc" }, take: 200, select: { key: true, headline: true } }) }, { headers }); }
  catch { return NextResponse.json({ error: "Não consegui abrir os assuntos silenciados." }, { status: 503, headers }); }
}
export async function POST(request: Request) {
  const access = await authorizeApi(request); if (access.response) return access.response;
  const parsed = z.object({ key: z.string().regex(/^[a-f0-9]{64}$/), action: z.enum(["SEEN", "DISMISS", "RESTORE"]), version: z.number().int().nonnegative().optional() }).strict().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Assunto inválido." }, { status: 400, headers });
  try {
    if (parsed.data.action === "SEEN" && parsed.data.version === undefined) return NextResponse.json({ error: "Reabra a conversa para registrar esta leitura." }, { status: 409, headers });
    const result = await prisma.editorialMemory.updateMany({ where: { userId: access.userId, key: parsed.data.key, ...(parsed.data.action === "SEEN" ? { version: parsed.data.version } : {}) }, data: parsed.data.action === "SEEN" ? { seenAt: new Date() }
      : parsed.data.action === "DISMISS" ? { dismissed: true } : { dismissed: false, seenAt: null, version: { increment: 1 } } });
    return NextResponse.json({ success: result.count > 0 }, { status: result.count ? 200 : 404, headers });
  } catch { return NextResponse.json({ error: "Não consegui guardar essa escolha. Tente novamente." }, { status: 503, headers }); }
}
