import { beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), lock: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { recommendationItem: { findFirst: db.find },
  $transaction: (fn: any) => fn({ $queryRaw: db.lock, recommendationItem: { findFirst: db.find, update: db.update } }) } }));
import { CulturalContextService } from "./cultural-context-service";
const snapshot = () => ({ provider: "lastfm", kind: "album", status: "AVAILABLE", artistName: "Banda", title: "Disco", requestedLanguage: "pt", recordingVerified: false,
  text: "Texto sintético com fonte para os testes, sem descrever um lançamento real.", sourceUrl: "https://www.last.fm/music/Banda/Disco", fetchedAt: new Date().toISOString() });
const item = () => ({ id: "i", sessionId: "s", artistName: "Banda", trackName: "Faixa (Live)", albumName: "Disco", scoreComponents: { evidence: ["keep"], albumEdition: { collectionId: "42" } } });
beforeEach(() => { vi.resetAllMocks(); db.find.mockResolvedValue(item()); });
describe("private contextual snapshots", () => {
  it("checks ownership before querying, and never substitutes an artist when album is unknown", async () => {
    const lookup = vi.fn(); const service = new CulturalContextService({ lookup }); db.find.mockResolvedValue(null);
    await expect(service.load("owner", "foreign", "track")).rejects.toMatchObject({ status: 404 });
    db.find.mockResolvedValue({ ...item(), albumName: null }); await expect(service.load("owner", "i", "album")).rejects.toMatchObject({ status: 422 });
    expect(lookup).not.toHaveBeenCalled(); expect(db.find.mock.calls[0][0].where.session).toEqual({ userId: "owner", status: "ACTIVE" });
  });
  it("reuses a fresh owned snapshot without provider work", async () => {
    db.find.mockResolvedValue({ ...item(), scoreComponents: { culturalContext: { album: snapshot() } } }); const lookup = vi.fn();
    expect(await new CulturalContextService({ lookup }).load("owner", "i", "album")).toMatchObject({ status: "AVAILABLE" });
    expect(lookup).not.toHaveBeenCalled(); expect(db.update).not.toHaveBeenCalled();
  });
  it("merges with current components under a session lock and does not touch position or responses", async () => {
    const value = snapshot(); await new CulturalContextService({ lookup: vi.fn().mockResolvedValue(value) }).load("owner", "i", "album");
    expect(db.update.mock.calls[0][0].data).toEqual({ scoreComponents: { ...item().scoreComponents, culturalContext: { album: value } } }); expect(db.lock).toHaveBeenCalledOnce();
  });
  it("rejects a mismatched or untrusted snapshot and does not store temporary errors", async () => {
    await expect(new CulturalContextService({ lookup: vi.fn().mockResolvedValue({ ...snapshot(), sourceUrl: "https://evil.test/" }) }).load("owner", "i", "album")).rejects.toMatchObject({ status: 503 });
    await expect(new CulturalContextService({ lookup: vi.fn().mockRejectedValue(new Error()) }).load("owner", "i", "album")).rejects.toMatchObject({ status: 503 }); expect(db.update).not.toHaveBeenCalled();
  });
  it("does not recreate an item deleted during the lookup", async () => {
    db.find.mockResolvedValueOnce(item()).mockResolvedValueOnce(null);
    await expect(new CulturalContextService({ lookup: vi.fn().mockResolvedValue(snapshot()) }).load("owner", "i", "album")).rejects.toMatchObject({ status: 404 }); expect(db.update).not.toHaveBeenCalled();
  });
});
