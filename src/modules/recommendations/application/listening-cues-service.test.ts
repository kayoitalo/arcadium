import { beforeEach, describe, it, expect, vi } from "vitest";
const db = vi.hoisted(() => ({ find: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { recommendationItem: { findFirst: db.find } } }));
import { ListeningCuesService } from "./listening-cues-service";
beforeEach(() => vi.resetAllMocks());
describe("owned recording invitations", () => {
  it("requires ownership and an active session, without external work or writes", async () => {
    db.find.mockResolvedValue(null);
    await expect(new ListeningCuesService().load("owner", "foreign")).rejects.toMatchObject({ status: 404 });
    expect(db.find.mock.calls[0][0].where).toEqual({ id: "foreign", session: { userId: "owner", status: "ACTIVE" } });
    db.find.mockResolvedValue({ artistName: "A", trackName: "T", scoreComponents: null });
    expect((await new ListeningCuesService().load("owner", "owned")).status).toBe("INSUFFICIENT_EVIDENCE");
  });
});
