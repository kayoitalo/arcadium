import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ register: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { editorialMemory: { createMany: mocks.register, findMany: mocks.read } } }));
import { EditorialService } from "./editorial-service";
import { editorialKey } from "../domain/editorial";
import type { ConversationMoment } from "../domain/conversation.types";
const first = { headline: "A recent fact", period: "7d", evidence: { kind: "ranking", unit: "artist", rows: [{ label: "Band", sub: "", plays: 3 }], focusIndex: 0 } } as ConversationMoment;
beforeEach(() => { vi.resetAllMocks(); mocks.read.mockResolvedValue([]); });
describe("editorial presentation", () => {
  it("registers only source topics, keeps the first recent version and does not mark unseen cards as seen", async () => {
    const view = { moments: [first, { ...first, headline: "Annual wording", period: "1y" as const }], writing: false, hasHistory: true };
    const result = await new EditorialService().present("owner", view, false);
    expect(result.moments).toHaveLength(1); expect(result.moments[0].headline).toBe("A recent fact");
    expect(mocks.register).toHaveBeenCalledWith({ data: [{ userId: "owner", key: editorialKey(first), headline: "Band · destaques de reprodução" }], skipDuplicates: true });
    expect(mocks.read).toHaveBeenCalledWith({ where: { userId: "owner", key: { in: [editorialKey(first)] } } });
  });
  it("offers quiet/revisit states while preserving the version used to reject stale receipts", async () => {
    mocks.read.mockResolvedValue([{ key: editorialKey(first), dismissed: false, seenAt: new Date(), version: 2 }]);
    const view = { moments: [first], writing: false, hasHistory: true };
    expect((await new EditorialService().present("owner", view, false)).quiet).toBe(true);
    expect((await new EditorialService().present("owner", view, true)).moments[0].editorialVersion).toBe(2);
    mocks.read.mockResolvedValue([{ key: editorialKey(first), dismissed: true, seenAt: null, version: 2 }]);
    expect((await new EditorialService().present("owner", view, true)).moments).toEqual([]);
  });
});
