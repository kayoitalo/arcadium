import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
beforeEach(() => { vi.resetModules(); vi.stubGlobal("fetch", vi.fn()); });
afterEach(() => vi.unstubAllGlobals());
const wiki = "Uma descrição sintética do álbum, longa o suficiente para testar a atribuição da fonte sem afirmar nada sobre discos reais.";
const payload = (overrides = {}) => ({ album: { name: "Disco (Ao vivo)", artist: "Banda", url: "http://www.last.fm/music/Banda/Disco", wiki: { summary: `<b>${wiki}</b> <a href='https://evil.test'>Read more</a>` }, ...overrides } });
const ok = (data: unknown) => ({ ok: true, json: async () => data }) as Response;
describe("cultural context provenance", () => {
  it("queries once, disables correction, attributes plain text and single-flights without an artist fallback", async () => {
    const { LastFmContextAdapter } = await import("./lastfm-context-adapter"); vi.mocked(fetch).mockResolvedValue(ok(payload()));
    const api = new LastFmContextAdapter("test-key");
    const [value] = await Promise.all([api.lookup("album", "Banda", "Disco (Ao vivo)"), api.lookup("album", "Banda", "Disco (Ao vivo)")]);
    expect(value).toMatchObject({ status: "AVAILABLE", text: wiki, sourceUrl: "https://www.last.fm/music/Banda/Disco", recordingVerified: false });
    expect(fetch).toHaveBeenCalledOnce(); const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(url.searchParams.get("autocorrect")).toBe("0"); expect(url.searchParams.get("method")).toBe("album.getInfo"); expect(url.searchParams.has("username")).toBe(false);
    await api.lookup("album", "Banda", "Disco (Ao vivo)"); expect(fetch).toHaveBeenCalledOnce();
  });
  it.each([{ name: "Disco" }, { artist: "Outra Banda" }])("refuses identity correction: %o", async (change) => {
    const { LastFmContextAdapter } = await import("./lastfm-context-adapter"); vi.mocked(fetch).mockResolvedValue(ok(payload(change)));
    expect(await new LastFmContextAdapter("test-key").lookup("album", "Banda", "Disco (Ao vivo)")).toMatchObject({ status: "MISSING", reason: "IDENTITY_MISMATCH" });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it.each([{ url: "https://www.last.fm.attacker.test/music/Banda/Disco" }, { wiki: {} }, { url: "javascript:alert(1)" }])("leaves a gap when text or a trustworthy source is absent: %o", async (change) => {
    const { LastFmContextAdapter } = await import("./lastfm-context-adapter"); vi.mocked(fetch).mockResolvedValue(ok(payload(change)));
    expect(await new LastFmContextAdapter("test-key").lookup("album", "Banda", "Disco (Ao vivo)")).toMatchObject({ status: "MISSING", reason: "NO_TEXT" });
  });
  it("supports track wiki without borrowing the album's text", async () => {
    const { LastFmContextAdapter } = await import("./lastfm-context-adapter");
    vi.mocked(fetch).mockResolvedValue(ok({ track: { name: "Faixa", artist: { name: "Banda" }, url: "https://www.last.fm/music/Banda/_/Faixa", wiki: { summary: wiki } } }));
    expect(await new LastFmContextAdapter("test-key").lookup("track", "Banda", "Faixa")).toMatchObject({ kind: "track", status: "AVAILABLE", recordingVerified: false });
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("keeps transient failure distinct from missing text and cools down instead of retrying", async () => {
    const { LastFmContextAdapter } = await import("./lastfm-context-adapter"); vi.mocked(fetch).mockResolvedValue(ok({ error: 29, message: "rate limit" }));
    const api = new LastFmContextAdapter("test-key");
    await expect(api.lookup("album", "Banda", "Disco")).rejects.toThrow(); await expect(api.lookup("album", "Banda", "Disco")).rejects.toThrow(); expect(fetch).toHaveBeenCalledOnce();
  });
  it("does not access the network when unconfigured", async () => {
    const { LastFmContextAdapter } = await import("./lastfm-context-adapter");
    expect(await new LastFmContextAdapter("").lookup("track", "Banda", "Faixa")).toMatchObject({ status: "MISSING", reason: "NOT_CONFIGURED" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
