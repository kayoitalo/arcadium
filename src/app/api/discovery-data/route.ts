import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authorizeApi } from "@/lib/security/api-auth";
import { sourceSnapshots } from "@/modules/recommendations/domain/source-snapshots";
const headers = { "Cache-Control": "private, no-store" };
const cursorSchema = z.object({ section: z.number().int().min(0).max(6), after: z.string().max(200) }).strict();
const sections = ["sessions", "items", "responses", "collection", "exports", "editorial", "preview-starts"];
export async function GET(request: Request) {
  const access = await authorizeApi(request); if (access.response) return access.response;
  const params = new URL(request.url).searchParams;
  let cursor = { section: 0, after: "" }; let until = new Date();
  try {
    if (params.get("cursor")) { const raw = params.get("cursor")!; if (raw.length > 1000) throw new Error(); cursor = cursorSchema.parse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8"))); }
    if (params.get("until")) until = new Date(z.string().datetime().parse(params.get("until")));
  } catch { return NextResponse.json({ error: "Página de exportação inválida." }, { status: 400, headers }); }
  try {
    const page = { orderBy: { id: "asc" as const }, take: 101 };
    const own = { userId: access.userId, createdAt: { lte: until }, ...(cursor.after ? { id: { gt: cursor.after } } : {}) };
    const rows = cursor.section === 0 ? await prisma.recommendationSession.findMany({ ...page, where: own, select: { id: true, createdAt: true, status: true, currentRank: true, mode: true, discoveryContext: true } })
      : cursor.section === 1 ? await prisma.recommendationItem.findMany({ ...page, where: { createdAt: { lte: until }, ...(cursor.after ? { id: { gt: cursor.after } } : {}), session: { userId: access.userId } }, select: { id: true, sessionId: true, artistName: true, trackName: true, albumName: true, reason: true, rank: true, exposedAt: true, createdAt: true, scoreComponents: true, appleMusicUrl: true } })
      : cursor.section === 2 ? await prisma.recommendationFeedback.findMany({ ...page, where: own, select: { id: true, itemId: true, type: true, channel: true, revision: true, note: true, details: true, revisesId: true, createdAt: true } })
      : cursor.section === 3 ? await prisma.collectionEntry.findMany({ ...page, where: own, select: { id: true, sourceItemId: true, artistName: true, trackName: true, action: true, createdAt: true, updatedAt: true } })
      : cursor.section === 4 ? await prisma.playlistExport.findMany({ ...page, where: own, select: { id: true, sessionId: true, mode: true, playlistUrl: true, totalItems: true, resolvedCount: true, createdAt: true } })
      : cursor.section === 5 ? await prisma.editorialMemory.findMany({ ...page, where: own, select: { id: true, key: true, headline: true, seenAt: true, dismissed: true, createdAt: true } })
      : await prisma.discoveryEvent.findMany({ ...page, where: own, select: { id: true, itemId: true, createdAt: true } });
    const records = rows.slice(0, 100).map((row) => {
      if (cursor.section !== 1) return row;
      const { scoreComponents, ...record } = row as typeof row & { scoreComponents?: unknown };
      return { ...record, ...sourceSnapshots(scoreComponents, record as { artistName: string; trackName: string; appleMusicUrl?: string | null }) };
    });
    const next = rows.length > 100 ? { section: cursor.section, after: records.at(-1)!.id } : cursor.section < sections.length - 1 ? { section: cursor.section + 1, after: "" } : null;
    return NextResponse.json({ section: sections[cursor.section], records, until: until.toISOString(), nextCursor: next ? Buffer.from(JSON.stringify(next)).toString("base64url") : null }, { headers });
  } catch { return NextResponse.json({ error: "Não consegui exportar esta parte. Tente novamente." }, { status: 503, headers }); }
}
export async function DELETE(request: Request) {
  const access = await authorizeApi(request); if (access.response) return access.response;
  const parsed = z.object({ scope: z.enum(["COLLECTION", "RESPONSES", "DISCOVERY", "EDITORIAL"]), confirmation: z.literal("APAGAR") }).strict().safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Escolha o escopo e confirme a exclusão." }, { status: 400, headers });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const sessions = await tx.$queryRaw<Array<{ status: string; updatedAt?: Date }>>`SELECT "status", "updatedAt" FROM "RecommendationSession" WHERE "userId" = ${access.userId} ORDER BY "id" FOR UPDATE`;
      if (sessions.some((row) => ["GENERATING", "PENDING"].includes(row.status) && (!row.updatedAt || Date.now() - row.updatedAt.getTime() < 5 * 60_000))) return null;
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${access.userId} FOR UPDATE`;
      const where = { userId: access.userId };
      // A generation may have reserved a new session between the first lock
      // query and the user lock. Recheck after excluding concurrent reservations.
      if (await tx.recommendationSession.findFirst({ where: { ...where, status: { in: ["GENERATING", "PENDING"] }, updatedAt: { gte: new Date(Date.now() - 5 * 60_000) } }, select: { id: true } })) return null;
      if (["COLLECTION", "DISCOVERY"].includes(parsed.data.scope)) await tx.collectionEntry.deleteMany({ where });
      if (parsed.data.scope === "RESPONSES") {
        await tx.recommendationFeedback.deleteMany({ where });
        await tx.recommendationItem.updateMany({ where: { session: { userId: access.userId } }, data: { status: "PENDING" } });
      }
      if (parsed.data.scope === "DISCOVERY") await tx.recommendationSession.deleteMany({ where });
      if (["EDITORIAL", "DISCOVERY"].includes(parsed.data.scope)) await tx.editorialMemory.deleteMany({ where });
      return true;
    });
    return NextResponse.json(result ? { success: true } : { error: "Há uma busca em andamento. Aguarde antes de apagar a memória." }, { status: result ? 200 : 409, headers });
  } catch { return NextResponse.json({ error: "Não consegui concluir a exclusão. Tente novamente." }, { status: 503, headers }); }
}
