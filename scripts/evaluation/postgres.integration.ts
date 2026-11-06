import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { assertTestSchema, isolatedDatabase } from "../../src/lib/runtime/isolated-database.mjs";
import { databaseFingerprint } from "../../src/lib/runtime/deployment-policy.mjs";
import { runRetention } from "../../src/lib/runtime/retention-policy.mjs";
const state = vi.hoisted(() => ({ client: null as unknown as PrismaClient }));
vi.mock("@/lib/db/prisma", () => ({ prisma: new Proxy({}, { get: (_, key) => {
  const value = Reflect.get(state.client, key, state.client); return typeof value === "function" ? value.bind(state.client) : value;
} }) }));
import { RecommendationService } from "../../src/modules/recommendations/application/recommendation-service";
import { SessionMemoryService } from "../../src/modules/recommendations/application/session-memory-service";
import { CollectionService } from "../../src/modules/recommendations/application/collection-service";
import { TerritoryService } from "../../src/modules/recommendations/application/territory-service";
import { AlbumJourneyService } from "../../src/modules/recommendations/application/album-journey-service";
import { DiscoveryMemoryService } from "../../src/modules/recommendations/application/discovery-memory-service";
import { WeeklyJourneyService } from "../../src/modules/recommendations/application/weekly-journey-service";
import type { WeeklySelection } from "../../src/modules/recommendations/application/weekly-selector";
import { CARTOLA_1976 } from "../../src/modules/recommendations/domain/curated-albums";
import { TERRITORY_VERSION } from "../../src/modules/recommendations/domain/territories";
const timings: Array<{ scenario: string; elapsedMs: number; queries: number }> = [];
let queryCount = 0;
const user = randomUUID(); const stranger = randomUUID();
const provider = { isConfigured: () => false, getSimilarArtists: vi.fn(), getTopTracks: vi.fn(), getArtistReach: vi.fn() };
const service = () => new RecommendationService(provider as any, { findTrackCover: vi.fn() } as any, { findPreview: vi.fn() } as any, "hybrid");
async function timed<T>(scenario: string, fn: () => Promise<T>) { const start = performance.now(); const before = queryCount; const result = await fn(); timings.push({ scenario, elapsedMs: performance.now() - start, queries: queryCount - before }); return result; }
beforeAll(async () => {
  const schema = assertTestSchema(process.env.ARCADIUM_TEST_SCHEMA);
  if (!process.env.DATABASE_URL) throw new Error("Run only through postgres-isolated.mjs");
  const confirmed = isolatedDatabase({ ...process.env, DATABASE_URL: undefined });
  if (databaseFingerprint(process.env.DATABASE_URL) !== databaseFingerprint(confirmed.href)) throw new Error("Integration client differs from confirmed isolated destination");
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema}`, max: 8 }, { schema }), log: [{ emit: "event", level: "query" }] });
  client.$on("query", () => { queryCount++; }); state.client = client;
  expect((await state.client.$queryRawUnsafe<Array<{ current_schema: string }>>("SELECT current_schema()"))[0].current_schema).toBe(schema);
  await state.client.user.createMany({ data: [{ id: user, email: `eval-${user}@example.invalid` }, { id: stranger, email: `eval-${stranger}@example.invalid` }] });
  for (let i = 0; i < 8; i++) {
    const artist = await state.client.artist.create({ data: { name: `Synthetic Dub ${i}`, normalizedName: `synthetic dub ${i}`, tags: "dub,reggae", metadataStatus: "RESOLVED", enrichedAt: new Date(),
      tracks: { create: [{ name: `Door ${i} (Live)`, normalizedName: `door ${i} (live)`, durationMs: 180000, enrichedAt: new Date(), itunesTrackId: String(i + 1),
        appleMusicUrl: `https://music.apple.com/br/album/synthetic/42?i=${i + 1}` }] } }, include: { tracks: true } });
    if (i === 0) {
      const album = await state.client.album.create({ data: { artistId: artist.id, name: "Synthetic Album", normalizedName: "synthetic album",
        itunesCollectionId: "42", itunesGenre: "dub", itunesFetchedAt: new Date() } });
      await state.client.listeningEvent.create({ data: { userId: user, playedAt: new Date(), provider: "synthetic", providerEventKey: randomUUID(),
        rawArtistName: artist.name, rawTrackName: artist.tracks[0].name, rawAlbumName: album.name, artistId: artist.id, trackId: artist.tracks[0].id, albumId: album.id } });
    }
  }
});
afterAll(async () => {
  mkdirSync(".local/evaluation", { recursive: true }); writeFileSync(".local/evaluation/postgres-report.json", JSON.stringify({ version: 1, evidence: "REAL_POSTGRES_SYNTHETIC_ACCOUNTS", timings, productionUsed: false, providerCalls: 0, personalMemoryDeleted: false }, null, 2));
  await state.client?.$disconnect();
});
describe("real isolated PostgreSQL operations", () => {
  it("prepares one week across concurrent tabs, starts both door types once and preserves the earlier week", async () => {
    const album = { provider: "itunes" as const, collectionId: "42", storefront: "BR", artistName: "Álbum sintético", albumName: "Disco da semana",
      trackCount: 2, releaseDate: null, artworkUrl: null, genre: "Samba", fetchedAt: "2026-11-05T10:00:00Z", sourceUrl: "https://music.apple.com/br/album/42" };
    const entries: WeeklySelection["entries"] = [{
      albumKey: "album:disco", releaseId: null,
      entry: { kind: "ALBUM", role: "NEAR", artistName: album.artistName, style: "Samba", family: "samba", reason: "Referência sintética.",
        reference: { provider: "history", url: null }, album,
        tracks: [1, 2].map((index) => ({ trackId: `42${index}`, artistName: album.artistName, trackName: `Faixa ${index}`, disc: 1,
          number: index, durationMs: 180_000, previewUrl: null, sourceUrl: `https://music.apple.com/br/album/42?i=42${index}` })) },
    }, {
      albumKey: null, releaseId: null,
      entry: { kind: "ARTIST", role: "TERRITORY", artistName: "Outra porta", style: "Dub", family: "reggae", reason: "Porta sintética.",
        reference: { provider: "catalog", url: null }, trackSource: "catalog", tracks: [{ artistName: "Outra porta", trackName: "Entrada" }] },
    }];
    const select = vi.fn(async () => ({ entries, personalized: true, diagnostics: { appleCalls: 0, lastFmCalls: 0, failures: 0, deadlineStops: 0 } }));
    let now = new Date("2026-11-05T10:00:00Z");
    const weekly = new WeeklyJourneyService({ select }, async (entries) => entries, () => now);
    await timed("concurrent-weekly-prepare", () => Promise.all([weekly.prepare(user), weekly.prepare(user)]));
    expect(select).toHaveBeenCalledOnce();
    const first = (await weekly.current(user)).current!;
    expect(first).toMatchObject({ status: "READY", weekKey: "2026-11-02", limited: true });
    expect(first.entries.map((entry) => entry.kind)).toEqual(["ALBUM", "ARTIST"]);
    expect(first.entries.every((entry) => !entry.exposedAt && !entry.sessionId)).toBe(true);
    await weekly.expose(stranger, first.entries[0].id);
    expect((await weekly.byId(user, first.id))?.entries[0].exposedAt).toBeNull();
    await weekly.expose(user, first.entries[0].id);
    await expect(weekly.start(stranger, first.entries[0].id)).rejects.toMatchObject({ status: 404 });
    await expect(weekly.byId(stranger, first.id)).rejects.toMatchObject({ status: 404 });
    const [a, b] = await timed("concurrent-weekly-start", () => Promise.all([weekly.start(user, first.entries[0].id), weekly.start(user, first.entries[0].id)]));
    expect(a).toEqual(b);
    const albumSession = await service().getSession(a.sessionId, user);
    expect(albumSession?.items.map((item) => item.trackName)).toEqual(["Faixa 1", "Faixa 2"]);
    expect(albumSession?.journey?.weekly).toEqual({ kind: "ALBUM", entryId: first.entries[0].id, journeyId: first.id });
    expect(albumSession?.items[0]).toMatchObject({ feedback: {}, previewUrl: null });
    const artist = await weekly.start(user, first.entries[1].id);
    expect((await service().getSession(artist.sessionId, user))?.journey?.weekly?.kind).toBe("ARTIST");
    now = new Date("2026-11-09T10:00:00Z");
    const next = (await weekly.prepare(user)).current!;
    expect(next.id).not.toBe(first.id);
    expect(select.mock.calls).toHaveLength(2);
    expect((await weekly.history(user)).weeks.map((week) => week?.id)).toEqual([next.id, first.id]);
    expect((await weekly.byId(user, first.id))?.entries[0]).toMatchObject({ sessionId: a.sessionId, exposedAt: "2026-11-05T10:00:00.000Z" });
  });
  it("applies additive migrations and checks destination/coverage on a real generated session", async () => {
    const result = await timed("territory-generation", () => service().generateSession({ userId: user, mode: "BALANCED", intent: "TERRITORY", operation: "NEW_ENTRY", requestKey: randomUUID(), territory: { version: TERRITORY_VERSION, genre: "dub" } }));
    expect(result.items).toHaveLength(6); expect(result.coverage).toMatchObject({ status: "INSUFFICIENT", selected: 6, requested: 8 });
    expect(result.items.every((item) => item.artistName !== "Synthetic Dub 0")).toBe(true);
    expect(result.settings.destination?.genre).toBe("dub"); expect(provider.getTopTracks).not.toHaveBeenCalled();
    expect(await service().getSession(result.sessionId, stranger)).toBeNull();
    const indexes = await state.client.$queryRawUnsafe<Array<{ indexname: string }>>("SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'RecommendationSession'");
    expect(indexes.some((row) => row.indexname === "RecommendationSession_status_updatedAt_idx")).toBe(true);
  });
  it("selects known repertoire by catalog duration and album genre from real rows", async () => {
    const input = { userId: user, mode: "BALANCED" as const, operation: "NEW_ENTRY" as const, intent: "REPERTOIRE" as const };
    const match = await service().generateSession({ ...input, requestKey: randomUUID(), restrictions: { albumGenre: "dub", maxDurationMs: 180000 } });
    expect(match.items).toHaveLength(1);
    expect(match.items[0]).toMatchObject({ albumName: "Synthetic Album", appleMusicUrl: "https://music.apple.com/br/album/synthetic/42?i=1",
      scoreComponents: { repertoireMediaBound: true, catalogFacts: { durationMs: 180000 } } });
    const tooLong = await service().generateSession({ ...input, requestKey: randomUUID(), restrictions: { albumGenre: "dub", maxDurationMs: 179999 } });
    expect(tooLong.items).toEqual([]);
  });
  it("persists and replays a curated album, with recording credit limited to its owner's diary", async () => {
    const { artistName, albumName, storefront, collectionId, trackIds, credit } = CARTOLA_1976;
    const sourceUrl = `https://music.apple.com/br/album/${collectionId}`;
    const album = { provider: "itunes" as const, artistName, albumName, storefront, collectionId, sourceUrl,
      trackCount: trackIds.length, releaseDate: "1976-01-01T00:00:00Z", fetchedAt: new Date().toISOString(), artworkUrl: null };
    const tracks = trackIds.map((trackId, index) => ({ trackId, artistName, disc: 1, number: index + 1,
      trackName: index === 0 ? "O Mundo É um Moinho" : `Faixa sintética ${index + 1}`,
      sourceUrl: `${sourceUrl}?i=${trackId}`, durationMs: 180_000, previewUrl: null }));
    const lookupEdition = vi.fn().mockResolvedValue({ album, tracks });
    const albums = new AlbumJourneyService({ lookupEdition, searchEditions: vi.fn() });
    const source = { kind: "curated" as const, id: credit.id }; const key = randomUUID();
    const result = await timed("curated-album-generation", () => albums.begin(user, source, collectionId, key));
    expect(result?.items.map((row) => row.trackName)).toEqual(tracks.map((row) => row.trackName));
    expect(await albums.begin(user, source, collectionId, key)).toMatchObject({ sessionId: result?.sessionId, journey: { curation: credit } });
    expect(lookupEdition).toHaveBeenCalledExactlyOnceWith(collectionId);
    const memory = new DiscoveryMemoryService(); const query = { q: artistName, responses: "0" as const };
    const page = await memory.list(user, query);
    expect(page.sessions[0]).toMatchObject({ id: result?.sessionId, curation: credit, total: trackIds.length });
    expect(page.sessions[0].items[0].listeningCues?.cues[0]).toMatchObject({ kind: "RECORDING_CREDIT", source: { sourceId: trackIds[0], collectionId } });
    expect(page.sessions[0].items[0]).toMatchObject({ exposedAt: null, feedback: [], starts: [] });
    expect((await memory.list(stranger, query)).sessions).toEqual([]);
  });
  it("serializes retries, feedback revisions and collection replay without duplicate writes", async () => {
    const key = randomUUID(); const request = { userId: user, mode: "BALANCED" as const, operation: "NEW_ENTRY" as const, requestKey: key, intent: "REPERTOIRE" as const };
    const results = await timed("concurrent-generation-retry", () => Promise.allSettled([service().generateSession(request), service().generateSession(request)]));
    expect(results.some((row) => row.status === "fulfilled")).toBe(true);
    const session = await service().generateSession(request); expect(await state.client.recommendationSession.count({ where: { userId: user, requestKey: key } })).toBe(1);
    expect(session.items).toHaveLength(1); const item = session.items[0]; const memory = new SessionMemoryService(); const requestKey = randomUUID();
    await timed("concurrent-feedback-replay", () => Promise.all([memory.recordFeedback(user, item.id, "LIKED", undefined, session.sessionId, { requestKey }), memory.recordFeedback(user, item.id, "LIKED", undefined, session.sessionId, { requestKey })]));
    expect(await state.client.recommendationFeedback.count({ where: { userId: user, itemId: item.id } })).toBe(1);
    expect((await new CollectionService().list(user))).toHaveLength(1);
    await new CollectionService().remove(user, item);
    await memory.recordFeedback(user, item.id, "LIKED", undefined, session.sessionId, { requestKey });
    expect((await new CollectionService().list(user))).toHaveLength(0);
  });
  it("rolls back failed writes, recovers stale reservations and never activates cancelled work", async () => {
    const session = await state.client.recommendationSession.create({ data: { userId: user, mode: "BALANCED", status: "GENERATING", requestKey: randomUUID(), updatedAt: new Date("2020-01-01") } });
    await expect(state.client.$transaction(async tx => { await tx.recommendationSession.update({ where: { id: session.id }, data: { status: "ACTIVE" } }); throw new Error("rollback fixture"); })).rejects.toThrow("rollback fixture");
    expect((await state.client.recommendationSession.findUniqueOrThrow({ where: { id: session.id } })).status).toBe("GENERATING");
    const input = { userId: user, mode: "BALANCED" as const, operation: "NEW_ENTRY" as const, requestKey: session.requestKey!, intent: "REPERTOIRE" as const };
    // Fingerprint conflict stays a conflict, never silently reuses another request.
    await expect(service().generateSession(input)).rejects.toMatchObject({ status: 409 });
    await expect((service() as any).populateSession({ userId: user, mode: "BALANCED", intent: "REPERTOIRE", discoveryContext: { version: 1, intent: "REPERTOIRE", journey: { action: "ENTRY" } } }, session.id, [])).rejects.toMatchObject({ code: "GENERATION_FAILED" });
    await state.client.recommendationSession.update({ where: { id: session.id }, data: { status: "FAILED" } });
    await expect((service() as any).populateSession({ userId: user, mode: "BALANCED", intent: "REPERTOIRE", discoveryContext: { version: 1, intent: "REPERTOIRE", journey: { action: "ENTRY" } } }, session.id, [])).rejects.toMatchObject({ code: "GENERATION_FAILED" });
    expect(await state.client.recommendationItem.count({ where: { sessionId: session.id } })).toBe(0);
    const request = { userId: user, mode: "BALANCED" as const, operation: "NEW_ENTRY" as const, requestKey: randomUUID(), intent: "REPERTOIRE" as const };
    const prepared = await service().generateSession(request);
    await state.client.recommendationItem.deleteMany({ where: { sessionId: prepared.sessionId } });
    await state.client.recommendationSession.update({ where: { id: prepared.sessionId }, data: { status: "GENERATING", updatedAt: new Date("2020-01-01") } });
    await expect(service().generateSession(request)).rejects.toMatchObject({ code: "GENERATION_FAILED" });
    expect((await state.client.recommendationSession.findUniqueOrThrow({ where: { id: prepared.sessionId } })).status).toBe("FAILED");
  });
  it("dry-runs and repeats skip-locked retention while preserving discovery and listening memory", async () => {
    const asOf = new Date().toISOString(); const expired = new Date("2020-01-01");
    await state.client.appSession.createMany({ data: ["a", "b", "c"].map((key) => ({ tokenHash: key, userId: user, credentialVersion: "synthetic", expiresAt: expired })) });
    await state.client.appSession.create({ data: { tokenHash: "valid", userId: user, credentialVersion: "synthetic", expiresAt: new Date(Date.now() + 86400000) } });
    const policy = { version: 1, personalMemory: "PRESERVE", batchSize: 2, scopes: { expiredSessions: 1 } };
    const before = await state.client.recommendationSession.count({ where: { userId: user } });
    const fingerprint = databaseFingerprint(process.env.DATABASE_URL!);
    const dry = await runRetention(state.client, policy, { asOf, databaseFingerprint: fingerprint });
    expect(dry.results[0]).toMatchObject({ eligible: 3, changed: 0 });
    const opts = { asOf, apply: true, expectedPlanHash: dry.planHash, databaseFingerprint: fingerprint };
    await timed("concurrent-operational-retention", () => Promise.all([runRetention(state.client, policy, opts), runRetention(state.client, policy, opts)]));
    expect((await runRetention(state.client, policy, opts)).results[0].changed).toBe(0);
    expect(await state.client.appSession.count({ where: { userId: user } })).toBe(1);
    expect(await state.client.recommendationSession.count({ where: { userId: user } })).toBe(before);
    expect(await state.client.listeningEvent.count({ where: { userId: user } })).toBe(1);
  });
  it("records actual explain plans and timings without asserting representative performance", async () => {
    await state.client.$executeRawUnsafe(`INSERT INTO "RecommendationSession" (id, "userId", mode, status, "lastOpenedAt", "updatedAt") SELECT 'explain-' || n, $1, 'BALANCED', 'ACTIVE', now() - (n || ' seconds')::interval, now() FROM generate_series(1, 5000) n`, user);
    await state.client.$executeRawUnsafe('ANALYZE "RecommendationSession"');
    const explain = "EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id FROM \"RecommendationSession\" WHERE \"userId\" = $1 AND status = 'ACTIVE' ORDER BY \"lastOpenedAt\" DESC NULLS LAST, \"createdAt\" DESC, id DESC LIMIT 1";
    const indexed = await timed("latest-session-indexed-explain", () => state.client.$queryRawUnsafe(explain, user));
    // Drop only the new index in a rolled-back transaction, in the disposable schema.
    let baseline;
    const rollback = new Error("rollback explain-only index removal");
    await expect(state.client.$transaction(async tx => {
      await tx.$executeRawUnsafe('DROP INDEX "recommendation_session_resume_idx"');
      baseline = await tx.$queryRawUnsafe(explain, user);
      throw rollback;
    })).rejects.toThrow(rollback.message);
    writeFileSync(".local/evaluation/postgres-explain.json", JSON.stringify({ evidence: "REAL_DATABASE_5000_SYNTHETIC_SESSIONS", baseline, indexed }, null, 2));
    expect(JSON.stringify(indexed)).toContain("recommendation_session_resume_idx");
    expect(await new TerritoryService().doors()).toMatchObject({ version: TERRITORY_VERSION });
  });
});
