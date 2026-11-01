import { prisma } from "@/lib/db/prisma";
import { ItunesPreviewAdapter } from "../infrastructure/itunes-preview-adapter";
import { compatiblePreviewIdentity } from "../domain/preview-identity";
import { LastFmCoverAdapter } from "@/modules/enrichment/infrastructure/lastfm-cover-adapter";
import { DiscoveryConflict } from "../domain/feedback";

const pending = new Map<string, Promise<unknown>>();
export class SessionMediaService {
  constructor(private previews = new ItunesPreviewAdapter(), private covers = new LastFmCoverAdapter()) {}
  async resolve(userId: string, sessionId: string, itemId: string): Promise<any> {
    const item = await prisma.recommendationItem.findFirst({ where: { id: itemId, sessionId, session: { userId } } });
    if (!item) throw new DiscoveryConflict("Indicação não encontrada.", 404);
    const key = JSON.stringify([userId, sessionId, itemId]);
    const existing = pending.get(key);
    if (existing) return existing;
    const run = this.load(userId, sessionId, item);
    pending.set(key, run);
    try { return await run; } finally { pending.delete(key); }
  }
  private async load(userId: string, sessionId: string, item: any) {
    const components = item.scoreComponents ?? {};
    const identity = compatiblePreviewIdentity(components.previewIdentity, item);
    const saved = { coverUrl: item.coverUrl, previewUrl: identity ? item.previewUrl : null, appleMusicUrl: identity ? item.appleMusicUrl : null };
    if (components.media?.retryAt > Date.now()) return { ...saved, status: components.media.status };
    if (saved.previewUrl && saved.coverUrl) return { ...saved, status: "ready" };
    let preview = null;
    let failed = false;
    try { preview = await this.previews.findPreview(item.artistName, item.trackName); } catch { failed = true; }
    const match = compatiblePreviewIdentity(preview?.identity, item);
    const media = { ...saved, ...(match ? { previewUrl: preview!.url, appleMusicUrl: preview!.appleMusicUrl ?? null,
      coverUrl: preview!.artworkUrl ?? saved.coverUrl } : {}) };
    if (!media.coverUrl) {
      try { media.coverUrl = (await this.covers.findTrackCover(item.artistName, item.trackName))?.url ?? null; } catch { /* Audio remains usable. */ }
    }
    const status = media.previewUrl ? "ready" : failed ? "error" : "unavailable";
    const retryAt = Date.now() + (failed ? 30_000 : status === "ready" ? 86_400_000 : 3_600_000);
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "RecommendationSession" WHERE "id" = ${sessionId} AND "userId" = ${userId} FOR UPDATE`;
      const current = await tx.recommendationItem.findFirst({ where: { id: item.id, sessionId, session: { userId } } });
      if (!current) throw new DiscoveryConflict("Indicação não encontrada.", 404);
      await tx.recommendationItem.update({ where: { id: item.id }, data: { ...media,
        scoreComponents: { ...(current.scoreComponents as object ?? {}), ...(match ? { previewIdentity: match } : {}), media: { status, retryAt } } as any } });
    });
    return { ...media, status };
  }
}
