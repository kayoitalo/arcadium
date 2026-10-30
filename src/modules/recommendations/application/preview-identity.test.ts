import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ session: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { recommendationSession: { findFirst: mocks.session } } }));
import { RecommendationService } from "./recommendation-service";

beforeEach(() => vi.resetAllMocks());
describe("session recording provenance", () => {
  it.each([null, { match: "compatible-text-v1" }, { source: "itunes", sourceId: "123", match: "compatible-text-v1", artistName: "Band", trackName: "Song (Live)" }])(
    "keeps old session readable but withholds unverified or incompatible preview %j", async (identity) => {
      mocks.session.mockResolvedValue({ id: "s", mode: "BALANCED", algorithmVersion: "v1", items: [{
        id: "item", artistName: "Band", trackName: "Song", previewUrl: "https://audio.test/live",
        scoreComponents: { previewIdentity: identity },
      }] });
      const session = await new RecommendationService().getSession("s", "owner");
      expect(session?.items[0].id).toBe("item");
      expect(session?.items[0].previewUrl).toBeNull();
      expect(mocks.session).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "s", userId: "owner" } }));
    },
  );
  it("returns the preview and its source identity for matching recording text", async () => {
    const identity = { source: "itunes", sourceId: "123", match: "compatible-text-v1", artistName: "Band", trackName: "Song - Live" };
    mocks.session.mockResolvedValue({ id: "s", mode: "BALANCED", algorithmVersion: "v1", items: [{
      id: "item", artistName: "Band", trackName: "Song (Live)", previewUrl: "https://audio.test/live",
      scoreComponents: { previewIdentity: identity },
    }] });
    const item = (await new RecommendationService().getSession("s", "owner"))?.items[0];
    expect(item?.previewUrl).toBe("https://audio.test/live");
    expect(item?.scoreComponents.previewIdentity).toEqual(identity);
    expect(item?.previewIdentity).toEqual(identity);
  });
});
