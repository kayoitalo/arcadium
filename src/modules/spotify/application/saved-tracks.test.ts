import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ token: vi.fn(), reauth: vi.fn(), fetch: vi.fn() }));
vi.mock("./spotify-connection", async (original) => ({
  ...(await original<typeof import("./spotify-connection")>()),
  getValidAccessToken: mocks.token,
  markNeedsReauth: mocks.reauth,
}));
vi.mock("../infrastructure/spotify-http", () => ({ spotifyFetch: mocks.fetch }));

import { loadSavedTracks, readSavedTracks } from "./saved-tracks";
import { grantsLibrary } from "./spotify-connection";

const page = { items: [
  { added_at: "2026-11-20T10:00:00Z", track: { name: "Recente", artists: [{ name: "Alguém" }, { name: "Convidado" }] } },
  { added_at: "2026-11-01T10:00:00Z", track: null },
] };

beforeEach(() => { mocks.token.mockReset(); mocks.reauth.mockReset(); mocks.fetch.mockReset(); });

describe("readSavedTracks", () => {
  it("takes the lead artist and skips tracks gone from the catalog", () => {
    expect(readSavedTracks(page)).toEqual([{ artistName: "Alguém", trackName: "Recente", addedAt: "2026-11-20T10:00:00Z" }]);
    expect(readSavedTracks({})).toEqual([]);
  });
});

describe("grantsLibrary", () => {
  it("needs the library scope among the granted ones; an old connection without scope has none", () => {
    expect(grantsLibrary("playlist-modify-private user-library-read")).toBe(true);
    expect(grantsLibrary("playlist-modify-private playlist-modify-public")).toBe(false);
    expect(grantsLibrary(undefined)).toBe(false);
  });
});

describe("loadSavedTracks", () => {
  it("never calls Spotify for a connection made before the library permission", async () => {
    mocks.token.mockResolvedValue({ accessToken: "t", spotifyUserId: "u", scope: "playlist-modify-private" });
    expect(await loadSavedTracks("antigo")).toEqual([]);
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("reads the Curtidas with the token, and asks to reconnect when Spotify refuses it", async () => {
    mocks.token.mockResolvedValue({ accessToken: "t", spotifyUserId: "u", scope: "user-library-read" });
    mocks.fetch.mockResolvedValueOnce(new Response(JSON.stringify(page), { status: 200 }));
    expect(await loadSavedTracks("novo")).toHaveLength(1);
    expect(mocks.fetch.mock.calls[0][0]).toBe("https://api.spotify.com/v1/me/tracks?limit=50");
    mocks.fetch.mockResolvedValueOnce(new Response("{}", { status: 401 }));
    expect(await loadSavedTracks("revogado")).toEqual([]);
    expect(mocks.reauth).toHaveBeenCalledWith("revogado");
  });
  it("treats a blocked endpoint (403) as no Curtidas, without dropping the connection", async () => {
    mocks.token.mockResolvedValue({ accessToken: "t", spotifyUserId: "u", scope: "user-library-read" });
    mocks.fetch.mockResolvedValueOnce(new Response("{}", { status: 403 }));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await loadSavedTracks("dev")).toEqual([]);
    expect(mocks.reauth).not.toHaveBeenCalled();
  });
});
