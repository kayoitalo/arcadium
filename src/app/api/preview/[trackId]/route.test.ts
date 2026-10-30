import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), track: vi.fn(), preview: vi.fn() }));
vi.mock("@/lib/security/api-auth", () => ({ authorizeApi: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { track: { findFirst: mocks.track } } }));
vi.mock("@/modules/recommendations/infrastructure/itunes-preview-adapter", () => ({
  ItunesPreviewAdapter: class { findPreview = mocks.preview; },
}));
import { GET } from "./route";

const request = () => GET(new Request("https://app.test/api/preview/track"), { params: Promise.resolve({ trackId: "track" }) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ userId: "owner" });
  mocks.track.mockResolvedValue({ name: "Song (Live)", artist: { name: "Band" }, previewUrl: "https://wrong.test/studio" });
});

describe("owned preview revalidation", () => {
  it("requires authentication before database or provider calls", async () => {
    mocks.auth.mockResolvedValue({ response: NextResponse.json({}, { status: 401 }) });
    expect((await request()).status).toBe(401);
    expect(mocks.track).not.toHaveBeenCalled();
    expect(mocks.preview).not.toHaveBeenCalled();
  });
  it("redirects only to the newly matched preview, scoped to the owner", async () => {
    mocks.preview.mockResolvedValue({ url: "https://audio.test/live" });
    const response = await request();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://audio.test/live");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.track).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "track", listeningEvents: { some: { userId: "owner" } } } }));
    expect(mocks.preview).toHaveBeenCalledWith("Band", "Song (Live)");
  });
  it("does not leak another owner's track through provider requests", async () => {
    mocks.track.mockResolvedValue(null);
    expect((await request()).status).toBe(404);
    expect(mocks.preview).not.toHaveBeenCalled();
  });
  it("does not fall back to the old URL without a compatible match", async () => {
    mocks.preview.mockResolvedValue(null);
    const response = await request();
    expect(response.status).toBe(404);
    expect(response.headers.get("location")).toBeNull();
  });
  it("distinguishes a temporary provider failure from no match", async () => {
    mocks.preview.mockRejectedValue(new Error("HTTP 503"));
    expect((await request()).status).toBe(503);
  });
});
