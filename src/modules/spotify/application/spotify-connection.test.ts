import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), decrypt: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { providerConnection: { findUnique: mocks.find, update: mocks.update } } }));
vi.mock("@/lib/security/token-crypto", () => ({ decryptJson: mocks.decrypt, encryptJson: vi.fn(), hasEncryptionKey: vi.fn() }));
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); vi.stubGlobal("fetch", vi.fn());
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.find.mockResolvedValue({ status: "ACTIVE", encryptedTokens: "synthetic-encrypted" });
  mocks.decrypt.mockReturnValue({ accessToken: "old", refreshToken: "fixture-refresh", expiresAt: 0, spotifyUserId: "fixture-user", displayName: "Fixture" });
  mocks.update.mockResolvedValue({});
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("Spotify shared cooldown and existing OAuth", () => {
  it.each([429, 503])("keeps valid authorization active during a temporary HTTP %i", async status => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status }));
    const { getValidAccessToken } = await import("./spotify-connection");
    expect(await getValidAccessToken("owner")).toBeNull(); expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.find).toHaveBeenCalledWith({ where: { userId_provider: { userId: "owner", provider: "spotify" } } });
  });
  it("still requests reauthorization for a refused refresh grant", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }));
    const { getValidAccessToken } = await import("./spotify-connection");
    expect(await getValidAccessToken("owner")).toBeNull();
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "NEEDS_REAUTH" } }));
  });
});
