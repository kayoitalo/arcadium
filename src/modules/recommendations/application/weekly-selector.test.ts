import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlbumEdition } from "../domain/album-journey";
import { weeklyAlbumKey, weeklyWindow, type WeeklyAlbumEntry } from "../domain/weekly-journey";
import { WeeklySelector } from "./weekly-selector";
import { matchWeeklyRecordingCredits } from "./weekly-recording-evidence";

const db = vi.hoisted(() => ({ artists: vi.fn(), counts: vi.fn(), profile: vi.fn(), albumPlays: vi.fn(), albums: vi.fn() }));
vi.mock("@/lib/db/prisma", () => ({ prisma: { artist: { findMany: db.artists, groupBy: db.counts },
  listeningEvent: { groupBy: db.albumPlays }, album: { findMany: db.albums } } }));
vi.mock("./recommendation-service", () => ({ RecommendationService: class { buildUserProfile = db.profile; } }));

const near = { id: "near", name: "Artista perto", tags: "samba", tracks: [{ name: "Alternativa local" }],
  albums: [{ name: "Disco perto", itunesGenre: "Samba", itunesCollectionId: "42", releaseGroupMbid: "group-id", mbid: null }] };
const bridge = { id: "bridge", name: "Artista ponte", tags: "spiritual jazz", tracks: [], albums: [] };
const territory = { id: "outside", name: "Artista distante", tags: "dub", tracks: [],
  albums: [{ name: "Disco distante", itunesGenre: "Dub", itunesCollectionId: "44", releaseGroupMbid: null, mbid: null }] };
const fetchedAt = "2026-11-05T12:00:00Z";
function album(artistName: string, albumName: string, collectionId: string, genre: string): AlbumEdition {
  const sourceUrl = `https://music.apple.com/br/album/${collectionId}`;
  return { album: { artistName, albumName, collectionId, genre, sourceUrl, provider: "itunes", storefront: "BR", releaseDate: null, trackCount: 2, artworkUrl: null, fetchedAt },
    tracks: [1, 2].map((number) => ({ artistName, trackName: `Faixa ${number}`, trackId: collectionId + number, disc: 1, number, durationMs: 180_000,
      previewUrl: null, sourceUrl: `${sourceUrl}?i=${collectionId}${number}` })) };
}
const nearEdition = album(near.name, near.albums[0].name, "42", "Samba");
const distantEdition = album(territory.name, territory.albums[0].name, "44", "Dub");
const createSelector = () => {
  const lookupEdition = vi.fn(async (id: string) => id === "42" ? nearEdition : distantEdition);
  const charts = {
    isConfigured: () => true, beginDiscoveryWindow: vi.fn(), getDiagnostics: () => ({
      externalAttempts: 0, failures: 0, deadlineStops: 0, cacheHits: 0, coalesced: 0, skippedAfterFailure: 0,
    }),
    getSimilarArtists: vi.fn(async () => [{ name: bridge.name, match: 0.8 }]), getWeeklyAlbums: vi.fn(async () => []),
    getWeeklyArtists: vi.fn(async () => []), getTopTracks: vi.fn(async (artist: string) => [{ artistName: artist, trackName: "A mais tocada" },
      { artistName: artist, trackName: "Faixa nova" }, { artistName: "Homônimo", trackName: "Outra faixa" }]),
  };
  return { lookupEdition, charts, selector: new WeeklySelector({ lookupEdition, searchEditions: vi.fn() }, charts) };
};
beforeEach(() => {
  vi.resetAllMocks();
  db.artists.mockResolvedValue([near, bridge, territory]);
  db.counts.mockResolvedValue([]);
  db.albumPlays.mockResolvedValue([]);
  db.albums.mockResolvedValue([]);
  db.profile.mockResolvedValue({
    topArtistNames: [near.name], topGenres: ["samba"], knownArtistNames: new Set([near.name.toLowerCase()]),
    knownTrackKeys: new Set([`${bridge.name.toLowerCase()}|a mais tocada`]), feedbackMap: new Map(), totalPlays: 15,
    longTerm: { artists: [{ name: near.name, genres: ["samba"] }], tracks: [] },
    recent: { artists: [{ name: near.name, genres: ["samba"] }] }, likedTracks: [],
  });
});
describe("weekly selection from history and bounded catalog candidates", () => {
  it("forms three distinct doors and keeps an album complete while filtering an artist chart", async () => {
    const { selector, lookupEdition, charts } = createSelector();
    const result = await selector.select("owner", [], Date.now() + 2000);
    expect(result.entries.map(({ entry }) => [entry.role, entry.kind, entry.family])).toEqual([
      ["NEAR", "ALBUM", "samba"], ["BRIDGE", "ARTIST", "jazz"], ["TERRITORY", "ALBUM", "reggae"],
    ]);
    expect(result.entries[0].entry.tracks.map((track) => track.trackName)).toEqual(["Faixa 1", "Faixa 2"]);
    expect(result.entries[1].entry).toMatchObject({ tracks: [{ artistName: bridge.name, trackName: "Faixa nova" }], trackSource: "lastfm" });
    expect(charts.getSimilarArtists).toHaveBeenCalledExactlyOnceWith(near.name, 5);
    expect(lookupEdition.mock.calls).toEqual([["42"], ["44"]]);
  });

  it("avoids a previously exposed album group even after its artist can rotate in again", async () => {
    const { selector, lookupEdition } = createSelector();
    const result = await selector.select("owner", [{ artistKey: near.name.toLowerCase(), albumKey: weeklyAlbumKey(near.name, "Edição anterior", "group-id"),
      snapshot: null, exposedAt: new Date(), sessionId: null, weekStartsAt: new Date(Date.now() - 21 * 86_400_000) }], Date.now() + 2000);
    expect(result.entries[0].entry).toMatchObject({ role: "NEAR", kind: "ARTIST" });
    expect(lookupEdition).not.toHaveBeenCalledWith("42");
  });

  it("skips a well-heard album despite a different title format on its track previews", async () => {
    db.albumPlays.mockResolvedValue([
      { albumId: null, rawArtistName: near.name, rawAlbumName: "Disco perto", rawTrackName: "Faixa 1 (feat. Outro artista)", _count: { id: 3 } },
      { albumId: null, rawArtistName: near.name, rawAlbumName: "Disco perto (Deluxe Edition)", rawTrackName: "Faixa 2 (feat. Outro artista)", _count: { id: 2 } },
    ]);
    const { selector, lookupEdition } = createSelector();
    const result = await selector.select("owner", [], Date.now() + 2000);
    expect(result.entries[0].entry).toMatchObject({ artistName: near.name, role: "NEAR", kind: "ARTIST" });
    expect(lookupEdition).not.toHaveBeenCalledWith("42");
    expect(db.albumPlays).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: "owner" }) }));
  });

  it("lets one repeat track point to the rest of its album", async () => {
    db.albumPlays.mockResolvedValue([
      { albumId: null, rawArtistName: near.name, rawAlbumName: "Disco perto", rawTrackName: "Faixa 1", _count: { id: 12 } },
      { albumId: null, rawArtistName: near.name, rawAlbumName: "Disco perto", rawTrackName: "Faixa 1 (feat. Outro artista)", _count: { id: 4 } },
    ]);
    const { selector } = createSelector();
    const result = await selector.select("owner", [], Date.now() + 2000);
    expect(result.entries[0].entry).toMatchObject({ artistName: near.name, role: "NEAR", kind: "ALBUM" });
  });

  it("offers a catalog door to an account with no history without inventing a bridge", async () => {
    db.profile.mockResolvedValue({ topArtistNames: [], topGenres: [], knownArtistNames: new Set(), knownTrackKeys: new Set(),
      feedbackMap: new Map(), totalPlays: 0, likedTracks: [] });
    const { selector, charts } = createSelector();
    const result = await selector.select("new-account", [], Date.now() + 2000);
    expect(result.personalized).toBe(false);
    expect(result.entries.map(({ entry }) => entry.role)).toEqual(["TERRITORY"]);
    expect(result.entries[0].entry.reason).toContain("porta do catálogo");
    expect(charts.getSimilarArtists).not.toHaveBeenCalled();
  });
});

describe("weekly edition evidence", () => {
  it("keeps the calendar week across a daylight-saving change", () => {
    const window = weeklyWindow(new Date("2026-03-08T15:00:00Z"), "America/New_York");
    expect(window.weekKey).toBe("2026-03-02");
    expect(window.endsAt.toISOString()).toBe("2026-03-09T04:00:00.000Z");
    expect(window.endsAt.getTime() - window.startsAt.getTime()).toBe(167 * 3600_000);
  });

  it("keeps a credit only after checking the complete matching edition", () => {
    const entry: WeeklyAlbumEntry = { ...nearEdition, kind: "ALBUM", artistName: near.name, role: "NEAR", style: "Samba", family: "samba",
      reason: "Perto do gosto.", reference: { provider: "history", url: null } };
    const recordingId = "a948beea-d6dc-4dde-b053-0ec601373074";
    const tracks = entry.tracks.map((track) => ({ title: track.trackName, position: track.number, length: 180_000,
      recording: { id: recordingId, title: track.trackName, relations: [{ type: "instrument", artist: { name: "Pessoa creditada" }, attributes: ["oud"] }] } }));
    const release = { id: "66fa7861-9dba-4167-bdc0-c847e44aa612", title: entry.album.albumName, "artist-credit": [{ name: entry.artistName }],
      media: [{ position: 1, tracks }] };
    expect(matchWeeklyRecordingCredits(entry, release, fetchedAt).tracks[0].credit).toMatchObject({ sourceId: recordingId, instrument: "oud" });
    tracks[1].title += " (Live)";
    expect(matchWeeklyRecordingCredits(entry, release, fetchedAt).tracks.every((track) => !track.credit)).toBe(true);
  });
});
