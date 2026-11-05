import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
beforeEach(() => { vi.resetModules(); vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => vi.unstubAllGlobals());
const collection = (id: number, name = "Disco") => ({ wrapperType: "collection", collectionId: id, artistName: "Banda", collectionName: name, trackCount: 1,
  collectionViewUrl: `https://music.apple.com/br/album/${id}` });
const ok = (results: unknown[]) => ({ ok: true, json: async () => ({ results }) }) as Response;
describe("bounded catalog edition queries", () => {
  it("uses one search, keeps exact version qualifiers, deduplicates and single-flights the cache", async () => {
    const { ItunesCatalogAdapter } = await import("../itunes-catalog-adapter");
    vi.mocked(fetch).mockResolvedValue(ok([collection(1), collection(1), collection(2, "Disco (Deluxe)"), { ...collection(3), artistName: "Outra Banda" }]));
    const provider = new ItunesCatalogAdapter({ minIntervalMs: 0 });
    const results = await Promise.all([provider.searchEditions("Banda", "Disco"), provider.searchEditions("Banda", "Disco")]);
    expect(results[0].map((row) => row.collectionId)).toEqual(["1"]); expect(fetch).toHaveBeenCalledOnce();
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0])); expect(url.searchParams.get("entity")).toBe("album"); expect(url.searchParams.get("limit")).toBe("10");
    await new ItunesCatalogAdapter({ minIntervalMs: 0 }).searchEditions("Banda", "Disco"); expect(fetch).toHaveBeenCalledOnce();
    await new ItunesCatalogAdapter({ minIntervalMs: 0, country: "US" }).searchEditions("Banda", "Disco"); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("loads only the chosen collection with one lookup and does not retry a failed request", async () => {
    const { ItunesCatalogAdapter } = await import("../itunes-catalog-adapter"); const provider = new ItunesCatalogAdapter({ minIntervalMs: 0 });
    vi.mocked(fetch).mockResolvedValue(ok([collection(1), { wrapperType: "track", kind: "song", trackId: 10, collectionId: 1, collectionName: "Disco", artistName: "Banda", trackName: "Faixa", discNumber: 1, discCount: 1, trackNumber: 1 }]));
    expect((await provider.lookupEdition("1"))?.tracks).toHaveLength(1);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("id=1&entity=song&limit=200");
    expect(await provider.lookupEdition("invalid")).toBeNull(); expect(fetch).toHaveBeenCalledOnce();
    vi.mocked(fetch).mockRejectedValue(new Error("503")); await expect(provider.lookupEdition("2")).rejects.toThrow(); expect(fetch).toHaveBeenCalledTimes(2);
  });
});
