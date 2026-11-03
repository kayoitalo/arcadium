import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), library: vi.fn(), source: vi.fn(), editions: vi.fn(), begin: vi.fn(), context: vi.fn() }));
vi.mock("@/lib/security/api-auth", () => ({ authorizeApi: mocks.auth }));
vi.mock("@/modules/recommendations/application/album-journey-service", () => ({ AlbumJourneyService: class { library = mocks.library; source = mocks.source; editions = mocks.editions; begin = mocks.begin; } }));
vi.mock("@/modules/recommendations/application/cultural-context-service", () => ({ CulturalContextService: class { load = mocks.context; } }));
import { GET, POST } from "./route";
import { POST as contextPOST } from "../discovery-context/route";
const post = (body: unknown) => POST(new Request("https://app.test/api/album-journeys", { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ userId: "owner" }); });
describe("album and context endpoints", () => {
  it("authorizes reads and mutations before doing any work", async () => {
    mocks.auth.mockResolvedValue({ response: NextResponse.json({}, { status: 403 }) });
    expect((await GET(new Request("https://app.test/api/album-journeys"))).status).toBe(403);
    expect((await post({})).status).toBe(403); expect((await contextPOST(new Request("https://app.test/api/discovery-context", { method: "POST" }))).status).toBe(403);
    expect(mocks.library).not.toHaveBeenCalled(); expect(mocks.context).not.toHaveBeenCalled();
  });
  it("lists local owned albums without triggering a provider lookup", async () => {
    mocks.library.mockResolvedValue({ albums: [], more: false });
    const response = await GET(new Request("https://app.test/api/album-journeys?q=Disco&userId=other"));
    expect(mocks.library).toHaveBeenCalledExactlyOnceWith("owner", "Disco"); expect(mocks.editions).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("accepts only an owned reference, explicit edition and operation key", async () => {
    expect((await post({ action: "EDITIONS", artist: "unowned", album: "title" })).status).toBe(400);
    expect((await post({ action: "BEGIN", source: { kind: "library", id: "i" }, collectionId: "42" })).status).toBe(400);
    mocks.begin.mockResolvedValue({ sessionId: "s" }); const source = { kind: "library", id: "i" }; const key = crypto.randomUUID();
    expect((await post({ action: "BEGIN", source, collectionId: "42", requestKey: key })).status).toBe(200);
    expect(mocks.begin).toHaveBeenCalledExactlyOnceWith("owner", source, "42", key);
  });
  it("rejects arbitrary text context and binds the item to the authenticated owner", async () => {
    const request = (body: unknown) => new Request("https://app.test/api/discovery-context", { method: "POST", body: JSON.stringify(body) });
    expect((await contextPOST(request({ artist: "Banda", title: "Faixa" }))).status).toBe(400);
    mocks.context.mockResolvedValue({ status: "MISSING" }); const response = await contextPOST(request({ itemId: "owned", kind: "track" }));
    expect(response.status).toBe(200); expect(mocks.context).toHaveBeenCalledExactlyOnceWith("owner", "owned", "track"); expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
