import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn() }));
vi.mock("@/lib/security/api-auth", () => ({ authorizeApi: mocks.auth }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {} }));
vi.mock("@/modules/spotify/application/spotify-connection", () => ({
  isSpotifyConfigured: () => true,
  buildAuthorizeUrl: (state: string) => `https://accounts.spotify.com/authorize?state=${state}`,
}));
import { POST } from "./route";
beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockResolvedValue({ userId: "owner" }); });
describe("parallel Spotify authorization", () => {
  it("creates independent owner-bound cookies for each started flow", async () => {
    const request = () => new Request("https://app.test/api/spotify/connect", { method: "POST" });
    const [first, second] = await Promise.all([POST(request()), POST(request())]);
    const cookies = [first.cookies.getAll()[0], second.cookies.getAll()[0]];
    expect(cookies[0].name).not.toBe(cookies[1].name);
    for (const [index, response] of [first, second].entries()) {
      const state = new URL((await response.json()).authorizeUrl).searchParams.get("state");
      expect(cookies[index].value).toBe(`owner:${state}`);
      expect(cookies[index].httpOnly).toBe(true);
      expect(cookies[index].maxAge).toBe(600);
    }
  });
});
