import { prisma } from "@/lib/db/prisma";
import { editorialAvailable, editorialKey, editorialSubject } from "../domain/editorial";
import type { ConversationView } from "../domain/conversation.types";
export class EditorialService {
  async present(userId: string, view: ConversationView, revisit: boolean) {
    const unique = new Map<string, ConversationView["moments"][number]>();
    for (const moment of view.moments) if (!unique.has(editorialKey(moment))) unique.set(editorialKey(moment), moment);
    if (!unique.size) return { ...view, quiet: false };
    // Registration is not an exposure: only the visibility POST sets seenAt.
    await prisma.editorialMemory.createMany({ data: [...unique].map(([key, moment]) => ({ userId, key, headline: editorialSubject(moment).slice(0, 1000) })), skipDuplicates: true });
    const memory = await prisma.editorialMemory.findMany({ where: { userId, key: { in: [...unique.keys()] } } });
    // Seen topics remain readable on every visit; cooldown only changes priority.
    const entries = [...unique].filter(([key]) => !memory.find((row) => row.key === key)?.dismissed);
    if (!revisit) entries.sort(([a], [b]) => Number(editorialAvailable(memory.find(row => row.key === b), false)) - Number(editorialAvailable(memory.find(row => row.key === a), false)));
    const moments = entries
      .map(([key, moment]) => ({ ...moment, editorialKey: key, editorialVersion: memory.find((row) => row.key === key)?.version ?? 0 }));
    return { ...view, moments, quiet: view.moments.length > 0 && moments.length === 0 };
  }
}
