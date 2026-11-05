import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { readDiscoveryContext } from "../domain/discovery-intent";
import { DiscoveryConflict } from "../domain/feedback";
import { sourceSnapshots } from "../domain/source-snapshots";
import type { MemoryPage, memoryQuery } from "../domain/discovery-memory";

const cursorSchema = z.object({ at: z.string().datetime(), id: z.string().min(1).max(200) }).strict();
export function decodeMemoryCursor(value?: string) {
  if (!value) return null;
  try { return cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8"))); }
  catch { throw new DiscoveryConflict("A página do histórico é inválida. Volte ao início.", 400); }
}
export class DiscoveryMemoryService {
  async summary(userId: string) {
    const latest = await prisma.recommendationSession.findFirst({ where: { userId, status: "ACTIVE" },
      orderBy: [{ lastOpenedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }],
      select: { id: true, currentRank: true, createdAt: true, _count: { select: { items: true } }, items: { orderBy: { rank: "asc" }, take: 80, select: { artistName: true, trackName: true, rank: true } } } });
    if (!latest) return { latest: null };
    const current = latest.items.find((item) => item.rank === latest.currentRank);
    return { latest: { id: latest.id, currentRank: latest.currentRank, total: latest._count.items,
      current: current ? { artistName: current.artistName, trackName: current.trackName } : null } };
  }
  async list(userId: string, query: z.infer<typeof memoryQuery>): Promise<MemoryPage> {
    const cursor = decodeMemoryCursor(query.cursor);
    const rows = await prisma.recommendationSession.findMany({
      where: { userId, status: "ACTIVE",
        AND: [
          ...(query.q ? [{ items: { some: { OR: [{ artistName: { contains: query.q, mode: "insensitive" as const } }, { trackName: { contains: query.q, mode: "insensitive" as const } }] } } }] : []),
          ...(query.responses === "1" ? [{ items: { some: { feedback: { some: { userId } } } } }] : []),
        ],
        ...(cursor ? { OR: [{ createdAt: { lt: new Date(cursor.at) } }, { createdAt: new Date(cursor.at), id: { lt: cursor.id } }] } : {}),
      }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 6,
      select: { id: true, createdAt: true, currentRank: true, discoveryContext: true, _count: { select: { items: true } },
        exports: { where: { userId }, orderBy: { createdAt: "desc" }, take: 5, select: { createdAt: true, mode: true, totalItems: true, resolvedCount: true } },
        items: { orderBy: { rank: "asc" }, take: 20, select: { id: true, artistName: true, trackName: true, reason: true, rank: true, exposedAt: true, scoreComponents: true, appleMusicUrl: true,
          events: { where: { userId }, orderBy: { createdAt: "desc" }, take: 10, select: { createdAt: true } },
          feedback: { where: { userId }, orderBy: [{ revision: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }, { id: "desc" }], take: 11,
            select: { id: true, type: true, channel: true, revision: true, note: true, details: true, createdAt: true, revisesId: true } } } } },
    });
    const page = rows.slice(0, 5); const last = page.at(-1);
    return { sessions: page.map((row) => {
      const context = readDiscoveryContext(row.discoveryContext);
      return { id: row.id, createdAt: row.createdAt.toISOString(), currentRank: row.currentRank, intent: context?.intent ?? null, total: row._count.items,
        exports: row.exports.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
        anchor: context?.journey.anchor ? { artistName: context.journey.anchor.artistName, trackName: context.journey.anchor.trackName } : null,
        album: context?.journey.album ?? null,
        items: row.items.map(({ scoreComponents, ...item }) => ({ ...item, ...sourceSnapshots(scoreComponents, item), events: undefined, starts: item.events.map((event) => ({ createdAt: event.createdAt.toISOString() })), exposedAt: item.exposedAt?.toISOString() ?? null, moreFeedback: item.feedback.length > 10,
          feedback: item.feedback.slice(0, 10).map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() })) })) };
    }), nextCursor: rows.length > 5 && last ? Buffer.from(JSON.stringify({ at: last.createdAt.toISOString(), id: last.id })).toString("base64url") : null,
    limits: { sessions: 5, itemsPerSession: 20, feedbackPerItem: 10 } };
  }
}
