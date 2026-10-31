import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { FeedbackType } from "../domain/recommendation.types";
import { DiscoveryConflict, effectiveFeedback, feedbackChannel, feedbackStatus } from "../domain/feedback";
import { compatiblePreviewIdentity } from "../domain/preview-identity";

export interface FeedbackOptions {
  requestKey?: string;
  revisesId?: string;
  details?: { aspects?: string[] };
  advance?: boolean;
}

export class SessionMemoryService {
  async recordFeedback(userId: string, itemId: string, type: FeedbackType, note?: string,
    sessionId?: string, options: FeedbackOptions = {}) {
    return prisma.$transaction(async (tx) => {
      const targetSessionId = sessionId ?? (await tx.recommendationItem.findUnique({ where: { id: itemId }, select: { sessionId: true } }))?.sessionId;
      if (!targetSessionId) throw new DiscoveryConflict("Indicação não encontrada.", 404);
      // All progress and feedback writes lock the session first, in the same order.
      await tx.$queryRaw`SELECT "id" FROM "RecommendationSession" WHERE "id" = ${targetSessionId} AND "userId" = ${userId} FOR UPDATE`;
      const item = await tx.recommendationItem.findUnique({ where: { id: itemId }, include: { session: true } });
      if (!item || item.sessionId !== targetSessionId || item.session.userId !== userId) {
        throw new DiscoveryConflict("Indicação não encontrada ou não autorizada.", 404);
      }
      const history = await tx.recommendationFeedback.findMany({ where: { itemId, userId } });
      const states = effectiveFeedback(history);
      const replay = options.requestKey ? history.find((entry) => entry.requestKey === options.requestKey) : undefined;
      if (replay) {
        if (replay.type !== type || (replay.note ?? null) !== (note || null)
          || JSON.stringify(replay.details ?? null) !== JSON.stringify(options.details ?? null)) {
          throw new DiscoveryConflict("Esta resposta já foi enviada com outro conteúdo.");
        }
        return { success: true, feedbackId: replay.id, revision: replay.revision, states, currentRank: item.session.currentRank };
      }
      const target = options.revisesId ? history.find((entry) => entry.id === options.revisesId) : undefined;
      if (options.revisesId && !target) throw new DiscoveryConflict("Avaliação a revisar não encontrada.", 404);
      if (type === "RETRACTED" && !target) throw new DiscoveryConflict("Escolha a avaliação que quer retirar.", 400);
      const channel = type === "RETRACTED" ? target!.channel || feedbackChannel(target!.type) : feedbackChannel(type);
      const current = states[channel as keyof typeof states];
      if (target && (current?.id !== target.id || (target.channel || feedbackChannel(target.type)) !== channel)) {
        throw new DiscoveryConflict("Essa avaliação mudou. Reabra a sessão para revisar a resposta atual.");
      }
      // Legacy clients without an operation key may repeat only the current state.
      // A like -> dislike -> like is a new revision, never an old retry.
      if (!options.requestKey && current?.type === type && (current.note ?? null) === (note || null)
        && JSON.stringify(current.details ?? null) === JSON.stringify(options.details ?? null)) {
        return { success: true, feedbackId: current.id, revision: current.revision, states, currentRank: item.session.currentRank };
      }
      const revision = Math.max(0, ...history.map((entry) => entry.revision ?? 0)) + 1;
      const preview = compatiblePreviewIdentity((item.scoreComponents as Record<string, unknown> | null)?.previewIdentity, item);
      const created = await tx.recommendationFeedback.create({ data: {
        userId, itemId, type, channel, revision, requestKey: options.requestKey,
        revisesId: current?.id, note: note || null,
        ...(options.details ? { details: options.details as Prisma.InputJsonValue } : {}),
        entity: { kind: "track", trackId: item.trackId, artistName: item.artistName,
          trackName: item.trackName, preview: preview ?? null } as Prisma.InputJsonValue,
      } });
      await tx.recommendationItem.update({ where: { id: itemId }, data: { status: feedbackStatus[type] } });
      let currentRank = item.session.currentRank;
      if (options.advance && type !== "RETRACTED" && (currentRank == null || currentRank === item.rank)) {
        currentRank = item.rank + 1;
        await tx.recommendationSession.update({ where: { id: targetSessionId }, data: { currentRank } });
      }
      return { success: true, feedbackId: created.id, revision,
        states: effectiveFeedback([...history, created]), currentRank };
    });
  }

  async expose(userId: string, sessionId: string, itemId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "RecommendationSession" WHERE "id" = ${sessionId} AND "userId" = ${userId} FOR UPDATE`;
      const item = await tx.recommendationItem.findFirst({ where: { id: itemId, sessionId, session: { userId } }, select: { id: true } });
      if (!item) throw new DiscoveryConflict("Indicação não encontrada.", 404);
      await tx.recommendationItem.updateMany({ where: { id: item.id, exposedAt: null }, data: { exposedAt: new Date() } });
      return { success: true };
    });
  }

  async move(userId: string, sessionId: string, rank: number, expectedRank: number) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "RecommendationSession" WHERE "id" = ${sessionId} AND "userId" = ${userId} FOR UPDATE`;
      const session = await tx.recommendationSession.findFirst({ where: { id: sessionId, userId }, include: { items: { orderBy: { rank: "asc" } } } });
      if (!session) throw new DiscoveryConflict("Sessão não encontrada.", 404);
      const currentRank = session.currentRank ?? session.items.find((item) => item.status === "PENDING")?.rank ?? session.items.length + 1;
      if (currentRank !== expectedRank) throw new DiscoveryConflict("A posição mudou em outra aba. Retome a sessão.");
      if (rank < 1 || rank > session.items.length + 1) throw new DiscoveryConflict("Posição inválida.", 400);
      await tx.recommendationSession.update({ where: { id: session.id }, data: { currentRank: rank } });
      return { currentRank: rank };
    });
  }
}
