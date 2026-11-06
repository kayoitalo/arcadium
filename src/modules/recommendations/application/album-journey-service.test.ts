import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ unique: vi.fn(), session: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), album: vi.fn(), library: vi.fn(), item: vi.fn(), lock: vi.fn(), result: vi.fn() }));
vi.mock("@/lib/db/prisma", () => {
  const client = { recommendationSession: { findUnique: db.unique, findFirst: db.session, create: db.create, update: db.update, updateMany: db.updateMany },
    album: { findFirst: db.album, findMany: db.library }, recommendationItem: { findFirst: db.item }, $queryRaw: db.lock };
  return { prisma: { ...client, $transaction: (task: any) => task(client) } };
});
vi.mock("./recommendation-service", () => ({ RecommendationService: class { getSession = db.result; } }));
import { AlbumJourneyService } from "./album-journey-service";
import { CARTOLA_1976 } from "../domain/curated-albums";
const summary = { provider: "itunes" as const, collectionId: "42", storefront: "BR", artistName: "Banda", albumName: "Disco (Ao vivo)", trackCount: 2,
  sourceUrl: "https://music.apple.com/br/album/42", artworkUrl: null, releaseDate: null, fetchedAt: "2026-11-02T12:00:00.000Z" };
const edition = () => ({ album: summary, tracks: [1, 2].map((n) => ({ trackId: String(n), trackName: `Faixa ${n} (Ao vivo)`, artistName: "Banda", disc: 1, number: n, durationMs: null, previewUrl: null, sourceUrl: null })) });
const source = { kind: "library" as const, id: "owned-album" }; const key = "5ec86bad-7b26-4421-adab-1831308876b8";
beforeEach(() => {
  vi.resetAllMocks(); db.unique.mockResolvedValue(null); db.create.mockResolvedValue({ id: "new" });
  db.session.mockImplementation((args) => Promise.resolve(args.where.id ? { id: "new", status: "GENERATING" } : null));
  db.album.mockResolvedValue({ name: summary.albumName, artist: { name: "Banda" } });
  db.result.mockResolvedValue({ sessionId: "new", items: [] }); db.updateMany.mockResolvedValue({ count: 1 }); db.library.mockResolvedValue([]);
});
const provider = () => ({ searchEditions: vi.fn().mockResolvedValue([summary]), lookupEdition: vi.fn().mockResolvedValue(edition()) });
const curatedSource = { kind: "curated" as const, id: CARTOLA_1976.credit.id };
const curatedEdition = () => ({
  album: { ...summary, collectionId: CARTOLA_1976.collectionId, artistName: CARTOLA_1976.artistName, albumName: CARTOLA_1976.albumName,
    sourceUrl: `https://music.apple.com/br/album/${CARTOLA_1976.collectionId}`, releaseDate: "1976-01-01T00:00:00Z", trackCount: CARTOLA_1976.trackIds.length },
  tracks: CARTOLA_1976.trackIds.map((trackId, index) => ({ trackId, trackName: index === 0 ? "O Mundo É um Moinho" : `Faixa ${index + 1}`,
    artistName: CARTOLA_1976.artistName, disc: 1, number: index + 1, durationMs: null, previewUrl: null, sourceUrl: null })),
});

describe("published album journeys", () => {
  it("pins the edition and saves the complete ordered journey and applicable recording credit", async () => {
    const api = provider(); const published = curatedEdition(); api.lookupEdition.mockResolvedValue(published);
    const service = new AlbumJourneyService(api);
    await expect(service.editions("owner", curatedSource)).resolves.toMatchObject({ editions: [published.album] });
    await service.begin("owner", curatedSource, CARTOLA_1976.collectionId, key);
    expect(api.lookupEdition.mock.calls).toEqual([[CARTOLA_1976.collectionId], [CARTOLA_1976.collectionId]]);
    expect(api.searchEditions).not.toHaveBeenCalled(); expect(db.album).not.toHaveBeenCalled(); expect(db.item).not.toHaveBeenCalled();
    const data = db.update.mock.calls[0][0].data;
    expect(data.discoveryContext.journey.curation).toEqual(CARTOLA_1976.credit);
    expect(data.items.create.map((item: { scoreComponents: { albumEdition: { trackId: string } } }) => item.scoreComponents.albumEdition.trackId)).toEqual(CARTOLA_1976.trackIds);
    expect(data.items.create[0].scoreComponents.recordingCue).toMatchObject({ kind: "RECORDING_CREDIT", source: { sourceId: CARTOLA_1976.trackIds[0] } });
    expect(data.items.create[2].scoreComponents.recordingCue).toBeNull();
  });

  it("rejects drafts and substitute editions before calling the catalog or reserving a session", async () => {
    const api = provider(); const service = new AlbumJourneyService(api);
    await expect(service.editions("owner", { kind: "curated", id: "jazz-doors-v1" })).rejects.toMatchObject({ status: 404 });
    await expect(service.begin("owner", curatedSource, "42", key)).rejects.toMatchObject({ status: 400 });
    expect(api.lookupEdition).not.toHaveBeenCalled(); expect(db.create).not.toHaveBeenCalled();
  });

  it("reports a catalog gap when the pinned track order changes", async () => {
    const api = provider(); const published = curatedEdition(); published.tracks.reverse(); api.lookupEdition.mockResolvedValue(published);
    const service = new AlbumJourneyService(api);
    await expect(service.editions("owner", curatedSource)).resolves.toMatchObject({ editions: [] });
    await expect(service.begin("owner", curatedSource, CARTOLA_1976.collectionId, key)).rejects.toMatchObject({ code: "GENERATION_FAILED" });
    expect(db.update).not.toHaveBeenCalled(); expect(api.searchEditions).not.toHaveBeenCalled();
  });
});

describe("owned album journeys", () => {
  it("checks source ownership before any provider or reservation", async () => {
    db.album.mockResolvedValue(null); const api = provider();
    await expect(new AlbumJourneyService(api).begin("owner", source, "42", key)).rejects.toMatchObject({ status: 404 });
    expect(api.searchEditions).not.toHaveBeenCalled(); expect(db.create).not.toHaveBeenCalled();
    expect(db.album.mock.calls[0][0].where.listeningEvents).toEqual({ some: { userId: "owner" } });
  });
  it("bounds the local library and only accepts owned recommendation references with an album", async () => {
    await new AlbumJourneyService().library("owner", "Ao vivo");
    expect(db.library).toHaveBeenCalledWith(expect.objectContaining({ take: 21, where: expect.objectContaining({ listeningEvents: { some: { userId: "owner" } } }) }));
    db.item.mockResolvedValue({ artistName: "Banda", albumName: null }); const api = provider();
    await expect(new AlbumJourneyService(api).editions("owner", { kind: "recommendation", id: "i" })).rejects.toMatchObject({ status: 404 });
    expect(api.searchEditions).not.toHaveBeenCalled();
  });
  it("reserves before querying and saves the complete ordered edition without votes or inferred affinity", async () => {
    const api = provider(); await new AlbumJourneyService(api).begin("owner", source, "42", key);
    expect(db.create.mock.invocationCallOrder[0]).toBeLessThan(api.searchEditions.mock.invocationCallOrder[0]);
    expect(api.searchEditions).toHaveBeenCalledOnce(); expect(api.lookupEdition).toHaveBeenCalledExactlyOnceWith("42");
    const data = db.update.mock.calls[0][0].data;
    expect(data.discoveryContext.journey.album).toEqual(summary); expect(data.items.create.map((row: any) => row.rank)).toEqual([1, 2]);
    expect(data.items.create[0]).toMatchObject({ trackName: "Faixa 1 (Ao vivo)", score: 0, previewUrl: null,
      scoreComponents: { albumEdition: { collectionId: "42", trackId: "1", disc: 1, number: 1 } } });
    expect(data.items.create[0]).not.toHaveProperty("feedback");
  });
  it("replays the same active request without external calls and rejects a changed fingerprint", async () => {
    const api = provider(); const service = new AlbumJourneyService(api);
    db.unique.mockResolvedValue({ id: "new", status: "ACTIVE", requestFingerprint: JSON.stringify({ algorithmVersion: "album-v1", source, collectionId: "42" }) });
    await expect(service.begin("owner", source, "42", key)).resolves.toMatchObject({ sessionId: "new" });
    await expect(service.begin("owner", source, "43", key)).rejects.toMatchObject({ status: 409 });
    expect(api.searchEditions).not.toHaveBeenCalled(); expect(db.create).not.toHaveBeenCalled();
  });
  it("refuses a second generation and never calls the catalog while blocked", async () => {
    db.session.mockResolvedValue({ id: "generating" }); const api = provider();
    await expect(new AlbumJourneyService(api).begin("owner", source, "42", key)).rejects.toMatchObject({ code: "GENERATION_PENDING" });
    expect(api.searchEditions).not.toHaveBeenCalled(); expect(db.create).not.toHaveBeenCalled();
  });
  it.each(["unselected", "incomplete", "other-version", "other-store", "other-collection", "changed-classification"])("fails %s atomically without creating partial items", async (problem) => {
    const api = provider();
    if (problem === "unselected") api.searchEditions.mockResolvedValue([]);
    if (problem === "incomplete") api.lookupEdition.mockResolvedValue(null);
    if (problem === "other-version") api.lookupEdition.mockResolvedValue({ ...edition(), album: { ...summary, albumName: "Disco" } });
    if (problem === "other-store") api.lookupEdition.mockResolvedValue({ ...edition(), album: { ...summary, storefront: "US" } });
    if (problem === "other-collection") api.lookupEdition.mockResolvedValue({ ...edition(), album: { ...summary, collectionId: "99" } });
    if (problem === "changed-classification") { const modified = { ...edition(), album: { ...summary, explicitness: "cleaned" as const } }; api.lookupEdition.mockResolvedValue(modified); }
    await expect(new AlbumJourneyService(api).begin("owner", source, "42", key)).rejects.toMatchObject({ code: "GENERATION_FAILED" });
    expect(db.update).not.toHaveBeenCalled(); expect(db.updateMany).toHaveBeenCalledWith({ where: { id: "new", status: "GENERATING" }, data: { status: "FAILED" } });
    if (problem === "unselected") expect(api.lookupEdition).not.toHaveBeenCalled();
  });
  it("cannot reactivate a reservation ended while the catalog was loading", async () => {
    db.session.mockResolvedValue(null); const api = provider();
    await expect(new AlbumJourneyService(api).begin("owner", source, "42", key)).rejects.toMatchObject({ code: "GENERATION_FAILED" });
    expect(db.update).not.toHaveBeenCalled();
  });
});
