import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
import { RecommendationService } from "./recommendation-service";
import type { TrackPreview } from "../domain/preview-provider.interface";

afterEach(() => vi.useRealTimers());
describe("independent bounded artwork fallback", () => {
  it("only probes missing final artwork, without requiring audio or repeating Apple requests", async () => {
    const findTrackCover = vi.fn(async () => ({ url: "https://images.test/cover", source: "lastfm", entityType: "release", mbid: "" }));
    const findPreview = vi.fn();
    const service = new RecommendationService(undefined, { findTrackCover } as any, { findPreview });
    const candidates = Array.from({ length: 8 }, (_, i) => ({ artistName: "Band " + i, trackName: "Song" }));
    const covers = new Map([["band 0|song", "https://images.test/local"]]);
    const previews = new Map<string, TrackPreview>([["band 1|song", { url: "https://audio.test/song", artworkUrl: "https://images.test/apple" }]]);
    await (service as any).resolveFallbackCovers(candidates, covers, previews);
    expect(findTrackCover.mock.calls).toHaveLength(4);
    expect(findPreview).not.toHaveBeenCalled();
    expect(covers.get("band 2|song")).toBe("https://images.test/cover");
    expect(covers.has("band 6|song")).toBe(false);
  });
  it("does not start work after its deadline or discard existing covers on failure", async () => {
    const findTrackCover = vi.fn().mockRejectedValue(new Error("unavailable"));
    const service = new RecommendationService(undefined, { findTrackCover } as any);
    const candidates = [{ artistName: "Band", trackName: "Song" }];
    const covers = new Map([["other|song", "existing"]]);
    await (service as any).resolveFallbackCovers(candidates, covers, new Map(), Date.now() - 1);
    expect(findTrackCover).not.toHaveBeenCalled();
    await (service as any).resolveFallbackCovers(candidates, covers, new Map());
    expect(covers.get("other|song")).toBe("existing");
    expect(covers.has("band|song")).toBe(false);
  });
});
