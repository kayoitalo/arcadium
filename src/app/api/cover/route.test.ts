import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => vi.fn()); vi.mock("@/lib/security/api-auth", () => ({ authorizeApi: auth }));
import { GET } from "./route";
beforeEach(() => {
  vi.resetAllMocks(); auth.mockResolvedValue({ userId: "owner" });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("synthetic image", { headers: { "Content-Type": "image/jpeg" } })));
});
afterEach(() => vi.unstubAllGlobals());
const request = (source: string) => new Request("https://app.test/api/cover?u=" + encodeURIComponent(source));
describe("existing Spotify image proxy", () => {
  it("requires authentication before upstream work", async () => {
    auth.mockResolvedValue({ response: new Response(null, { status: 401 }) });
    expect((await GET(request("https://i.scdn.co/image/abc"))).status).toBe(401); expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps the existing CDN, with redirects disabled", async () => {
    expect((await GET(request("https://i.scdn.co/image/abc"))).status).toBe(200);
    expect(fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: "error" }));
  });
  it.each(["https://upload.wikimedia.org/wikipedia/commons/a.jpg", "https://thumb.wikimedia.org/wikipedia/commons/a.jpg",
    "https://i.scdn.co.evil.test/image/abc", "https://i.scdn.co/other/abc", "https://i.scdn.co:444/image/abc", "https://user@i.scdn.co/image/abc"])("refuses removed or unsafe source %s", async source => {
    expect((await GET(request(source))).status).toBe(403); expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["image/svg+xml", "text/html", ""])("refuses an unverified image MIME %s", async mime => {
    const headers = new Headers(); if (mime) headers.set("Content-Type", mime);
    vi.mocked(fetch).mockResolvedValue(new Response(new Uint8Array([0]), { headers }));
    expect((await GET(request("https://i.scdn.co/image/abc"))).status).toBe(415);
  });
});
