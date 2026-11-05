import { prisma } from "@/lib/db/prisma";
import { sameRecordingText } from "@/lib/music/recording-match";
import { DiscoveryConflict } from "../domain/feedback";
import { culturalContextSchema, readCulturalContexts, type ContextKind, type CulturalContextProvider } from "../domain/cultural-context";
import { LastFmContextAdapter } from "../infrastructure/lastfm-context-adapter";

export class CulturalContextService {
  constructor(private provider: CulturalContextProvider = new LastFmContextAdapter()) {}
  async load(userId: string, itemId: string, kind: ContextKind) {
    const item = await prisma.recommendationItem.findFirst({ where: { id: itemId, session: { userId, status: "ACTIVE" } } });
    if (!item) throw new DiscoveryConflict("Indicação não encontrada nesta conta.", 404);
    const title = kind === "album" ? item.albumName : item.trackName;
    if (!title) throw new DiscoveryConflict("Esta indicação não tem álbum identificado.", 422);
    const saved = readCulturalContexts((item.scoreComponents as any)?.culturalContext)[kind];
    if (saved && sameRecordingText(saved.artistName, item.artistName) && sameRecordingText(saved.title, title)
      && Date.now() - Date.parse(saved.fetchedAt) < (saved.status === "AVAILABLE" ? 24 * 3600000 : 15 * 60000)) return saved;
    let value;
    try { value = await this.provider.lookup(kind, item.artistName, title); }
    catch { throw new DiscoveryConflict("A fonte está indisponível agora. Você pode continuar ouvindo e tentar depois.", 503); }
    const parsed = culturalContextSchema.safeParse(value);
    if (!parsed.success || parsed.data.kind !== kind || !sameRecordingText(parsed.data.artistName, item.artistName) || !sameRecordingText(parsed.data.title, title)) {
      throw new DiscoveryConflict("Não consegui confirmar a referência devolvida pela fonte.", 503);
    }
    value = parsed.data;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "RecommendationSession" WHERE "id" = ${item.sessionId} AND "userId" = ${userId} FOR UPDATE`;
      const current = await tx.recommendationItem.findFirst({ where: { id: item.id, session: { userId, status: "ACTIVE" } } });
      if (!current) throw new DiscoveryConflict("Indicação não encontrada nesta conta.", 404);
      const components = current.scoreComponents as Record<string, any> | null;
      await tx.recommendationItem.update({ where: { id: item.id }, data: { scoreComponents: {
        ...components, culturalContext: { ...readCulturalContexts(components?.culturalContext), [kind]: value },
      } as any } });
    });
    return value;
  }
}
