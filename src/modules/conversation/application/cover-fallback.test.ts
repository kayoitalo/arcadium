import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
import { createCoverFallback } from "./cover-fallback";

const deps = (overrides: Partial<Parameters<typeof createCoverFallback>[0]> = {}) => ({
  findAlbumCover: vi.fn().mockResolvedValue(null),
  findTrackArtwork: vi.fn().mockResolvedValue(null),
  save: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("Conversa cover fallback", () => {
  it("prefers the album cover and saves it on the album so the next visit reads the database", async () => {
    const d = deps({ findAlbumCover: vi.fn().mockResolvedValue("https://is1.mzstatic.com/angels-cry/600x600bb.jpg") });
    const fallback = createCoverFallback(d);
    await expect(fallback("album-1", "Angra", "Angels Cry", "Carry On")).resolves.toBe("https://is1.mzstatic.com/angels-cry/600x600bb.jpg");
    expect(d.save).toHaveBeenCalledWith("album-1", "https://is1.mzstatic.com/angels-cry/600x600bb.jpg", "itunes");
    expect(d.findTrackArtwork).not.toHaveBeenCalled();
  });

  it("falls back to the track artwork, the behaviour the Conversa had before previews were revalidated", async () => {
    const d = deps({ findTrackArtwork: vi.fn().mockResolvedValue("https://is1.mzstatic.com/track.jpg") });
    await expect(createCoverFallback(d)("album-1", "Angra", "Angels Cry", "Carry On")).resolves.toBe("https://is1.mzstatic.com/track.jpg");
    expect(d.save).toHaveBeenCalledWith("album-1", "https://is1.mzstatic.com/track.jpg", "itunes-track");
  });

  it("does not hold the screen past its deadline and still saves when the catalog answers later", async () => {
    vi.useFakeTimers();
    try {
      let answer: (url: string) => void = () => undefined;
      const d = deps({ findAlbumCover: vi.fn(() => new Promise<string>((resolve) => { answer = resolve; })) });
      const pending = createCoverFallback({ ...d, timeoutMs: 100 })("album-1", "Angra", "Angels Cry", null);
      await vi.advanceTimersByTimeAsync(100);
      await expect(pending).resolves.toBeNull();
      answer("https://is1.mzstatic.com/late.jpg"); await vi.runAllTimersAsync();
      expect(d.save).toHaveBeenCalledWith("album-1", "https://is1.mzstatic.com/late.jpg", "itunes");
    } finally { vi.useRealTimers(); }
  });

  it("waits before retrying an album the catalog does not have, and shares one lookup between screens", async () => {
    let clock = 0;
    const d = deps();
    const fallback = createCoverFallback({ ...d, now: () => clock, missRetryMs: 1000 });
    await Promise.all([fallback("album-1", "A", "Disco", "Faixa"), fallback("album-1", "A", "Disco", "Faixa")]);
    expect(d.findAlbumCover).toHaveBeenCalledTimes(1);
    await fallback("album-1", "A", "Disco", "Faixa");
    expect(d.findAlbumCover).toHaveBeenCalledTimes(1);
    clock = 1001; await fallback("album-1", "A", "Disco", "Faixa");
    expect(d.findAlbumCover).toHaveBeenCalledTimes(2);
    expect(d.save).not.toHaveBeenCalled();
  });

  it("treats a catalog failure as a miss instead of breaking the Conversa", async () => {
    const d = deps({ findAlbumCover: vi.fn().mockRejectedValue(new Error("403")), findTrackArtwork: vi.fn().mockRejectedValue(new Error("403")) });
    await expect(createCoverFallback(d)("album-1", "A", "Disco", "Faixa")).resolves.toBeNull();
  });
});
