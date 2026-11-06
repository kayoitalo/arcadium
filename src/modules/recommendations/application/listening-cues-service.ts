import { prisma } from "@/lib/db/prisma";
import { DiscoveryConflict } from "../domain/feedback";
import { buildListeningCues } from "../domain/listening-cues";
export class ListeningCuesService {
  async load(userId: string, itemId: string) {
    const item = await prisma.recommendationItem.findFirst({ where: { id: itemId, session: { userId, status: "ACTIVE" } },
      select: { artistName: true, trackName: true, appleMusicUrl: true, scoreComponents: true } });
    if (!item) throw new DiscoveryConflict("Indicação não encontrada nesta conta.", 404);
    return buildListeningCues(item);
  }
}
