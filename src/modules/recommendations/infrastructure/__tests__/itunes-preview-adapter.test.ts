import { afterEach, describe, expect, it, vi } from "vitest";
import { ItunesPreviewAdapter } from "../itunes-preview-adapter";
import { ItunesCatalogAdapter } from "@/modules/enrichment/infrastructure/itunes-catalog-adapter";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("preview reliability", () => {
  it("coalesces concurrent requests and separates storefront caches", async () => {
    const searchTrack = vi.fn().mockResolvedValue(null);
    const brazil = new ItunesPreviewAdapter({ storefront: "BR", searchTrack } as unknown as ItunesCatalogAdapter);
    await Promise.all([brazil.findPreview("Concurrent Band", "Song"), brazil.findPreview("Concurrent Band", "Song")]);
    expect(searchTrack).toHaveBeenCalledOnce();
    const usa = new ItunesPreviewAdapter({ storefront: "US", searchTrack } as unknown as ItunesCatalogAdapter);
    await usa.findPreview("Concurrent Band", "Song");
    expect(searchTrack).toHaveBeenCalledTimes(2);
  });
  it("keeps returned recording evidence and does not cache transient failure as absence", async () => {
    const searchTrack = vi.fn().mockRejectedValueOnce(new Error("HTTP 503")).mockResolvedValue({
      trackId: "123", artistName: "Preview Retry Band", name: "Song (Live)", previewUrl: "https://audio.test/live",
      appleMusicUrl: "https://music.apple.com/test", artworkUrl: null,
    });
    const adapter = new ItunesPreviewAdapter({ searchTrack } as unknown as ItunesCatalogAdapter);
    await expect(adapter.findPreview("Preview Retry Band", "Song (Live)")).rejects.toThrow("HTTP 503");
    const preview = await adapter.findPreview("Preview Retry Band", "Song (Live)");
    expect(preview?.identity).toEqual({ source: "itunes", sourceId: "123", artistName: "Preview Retry Band",
      trackName: "Song (Live)", match: "compatible-text-v1" });
    expect(await adapter.findPreview("Preview Retry Band", "Song (Live)")).toEqual(preview);
    expect(searchTrack).toHaveBeenCalledTimes(2);
  });

  it("shares pacing between the default preview adapter and the enrichment catalog", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) }));
    const catalog = new ItunesCatalogAdapter();
    await catalog.searchAlbum("Paced Band", "Album");
    const pending = new ItunesPreviewAdapter().findPreview("Paced Band", "Paced Song");
    await vi.advanceTimersByTimeAsync(3099);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
