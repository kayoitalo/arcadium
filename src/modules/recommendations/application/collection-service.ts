import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { DiscoveryConflict, type FeedbackEntry } from "../domain/feedback";
import { MAX_SELECTED_TRACKS, type SelectedTrack } from "../domain/collection";

export const collectionKey = (track: Pick<SelectedTrack, "artistName" | "trackName">) => createHash("sha256")
  .update(JSON.stringify([track.artistName.trim().toLowerCase(), track.trackName.trim().toLowerCase()])).digest("hex");
type Tx = Prisma.TransactionClient;
export async function lockCollection(tx: Tx, userId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  if (!rows.length) throw new DiscoveryConflict("Conta não encontrada.", 404);
}
export async function putCollection(tx: Tx, userId: string, item: SelectedTrack) {
  const key = collectionKey(item);
  const existing = await tx.collectionEntry.findUnique({ where: { userId_key: { userId, key } } });
  if (!existing && await tx.collectionEntry.count({ where: { userId } }) >= MAX_SELECTED_TRACKS) {
    throw new DiscoveryConflict("A coleção está com 200 faixas. Remova uma antes de guardar outra.");
  }
  const data = { sourceItemId: item.id, artistName: item.artistName, trackName: item.trackName, action: item.action };
  await tx.collectionEntry.upsert({ where: { userId_key: { userId, key } }, create: { userId, key, ...data }, update: data });
}

/** Called only for a NEW feedback revision, under session -> user lock order. */
export async function collectFeedback(tx: Tx, userId: string, item: { id: string; artistName: string; trackName: string },
  states: Partial<Record<string, FeedbackEntry>>, channel: string, type: string) {
  if (channel !== "preference" && channel !== "collection") return;
  await lockCollection(tx, userId);
  if (type !== "LIKED" && type !== "SAVE_FOR_LATER") {
    const existing = await tx.collectionEntry.findUnique({ where: { userId_key: { userId, key: collectionKey(item) } } });
    // Removing a collection entry is independent of feedback. A negative/retraction
    // cannot resurrect it or erase a newer collection choice from another session.
    if (!existing || existing.sourceItemId !== item.id) return;
  }
  const action = states.collection?.type === "SAVE_FOR_LATER" ? "saved" : states.preference?.type === "LIKED" ? "liked" : null;
  if (action) await putCollection(tx, userId, { ...item, action });
  else await tx.collectionEntry.deleteMany({ where: { userId, key: collectionKey(item), sourceItemId: item.id } });
}

export class CollectionService {
  async list(userId: string) {
    const rows = await prisma.collectionEntry.findMany({ where: { userId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: MAX_SELECTED_TRACKS });
    return rows.map((row) => ({ id: row.sourceItemId, artistName: row.artistName, trackName: row.trackName, action: row.action as "liked" | "saved" }));
  }
  async remove(userId: string, item: Pick<SelectedTrack, "artistName" | "trackName">) {
    await prisma.$transaction(async (tx) => {
      await lockCollection(tx, userId);
      await tx.collectionEntry.deleteMany({ where: { userId, key: collectionKey(item) } });
    });
  }
  async importLocal(userId: string, items: SelectedTrack[]) {
    return prisma.$transaction(async (tx) => {
      await lockCollection(tx, userId);
      const owned = await tx.recommendationItem.findMany({ where: { id: { in: items.map((item) => item.id) }, session: { userId } },
        select: { id: true, artistName: true, trackName: true } });
      const imported: string[] = []; const importedItems: SelectedTrack[] = []; const skipped: string[] = [];
      const additions: Prisma.CollectionEntryCreateManyInput[] = [];
      const known = new Set((await tx.collectionEntry.findMany({ where: { userId }, select: { key: true } })).map((row) => row.key));
      for (const item of items) {
        const source = owned.find((row) => row.id === item.id && row.artistName === item.artistName && row.trackName === item.trackName);
        const key = collectionKey(item);
        if (!source || (!known.has(key) && known.size >= MAX_SELECTED_TRACKS)) { skipped.push(item.id); continue; }
        // Import never overwrites an existing account choice with an older browser copy.
        if (!known.has(key)) {
          additions.push({ userId, key, sourceItemId: item.id, artistName: item.artistName, trackName: item.trackName, action: item.action }); known.add(key);
        }
        imported.push(item.id); importedItems.push(item);
      }
      if (additions.length) await tx.collectionEntry.createMany({ data: additions });
      return { imported, importedItems, skipped };
    });
  }
}
