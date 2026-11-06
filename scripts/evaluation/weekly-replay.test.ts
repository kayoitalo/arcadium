import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { prepareWeeklyNarrative, readWeeklyNarrative } from "../../src/modules/recommendations/domain/weekly-narrative";
import { ItunesCatalogAdapter } from "../../src/modules/enrichment/infrastructure/itunes-catalog-adapter";
import { MusicBrainzAdapter } from "../../src/modules/enrichment/infrastructure/musicbrainz-adapter";
import { matchWeeklyRecordingCredits } from "../../src/modules/recommendations/application/weekly-recording-evidence";
import { LastFmSimilarArtistProvider } from "../../src/modules/recommendations/infrastructure/lastfm-similar-adapter";
import type { WeeklyView } from "../../src/modules/recommendations/domain/weekly-journey";

const directory = ".local/evaluation";
function report(name: string, payload: unknown) {
  mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/${name}.json`, JSON.stringify(payload, null, 2) + "\n");
}

it("prepares a deterministic comparison with identical synthetic doors and no model calls", () => {
  const base = [
    { id: "913c225a-b8bc-4520-8c8e-8b3f726b532f", position: 1, role: "NEAR", kind: "ALBUM", artistName: "Artista de teste", style: "Samba", trackCount: 3 },
    { id: "99ad1b04-923b-45e5-9e23-6d45384d9d01", position: 2, role: "TERRITORY", kind: "ARTIST", artistName: "Outro artista", style: "Dub", trackCount: 2 },
  ] as const;
  const entries: WeeklyView["entries"] = base.map((entry) => ({ ...entry, reason: "Motivo do catálogo",
    reference: { provider: "catalog", url: null }, sessionId: null, exposedAt: null }));
  const ids = entries.map((entry) => entry.id);
  const prompt = prepareWeeklyNarrative(entries);
  const output = { opening: "contrast", transitions: [{ entryId: ids[0], line: "first" }, { entryId: ids[1], line: "compare" }] };
  const presentation = readWeeklyNarrative(output, ids);
  expect(presentation).toBeDefined();
  expect(readWeeklyNarrative({ ...output, opening: "Invenção sobre a gravação" }, ids)).toBeUndefined();
  expect(readWeeklyNarrative({ ...output, transitions: [output.transitions[0], output.transitions[0]] }, ids)).toBeUndefined();
  expect(prompt).not.toContain("Artista de teste");
  const hash = createHash("sha256").update(prompt).digest("hex");
  report("weekly-narrative-replay", { provenance: "SYNTHETIC", hash, prompt, entries,
    variants: { plain: { opening: "Abre uma porta de cada vez. Teu lugar fica guardado." }, constrainedExample: presentation },
    comparison: { identicalEntries: true, providerAttempts: 0, humanJudgments: null } });
});

it.skipIf(process.env.ARCADIUM_WEEKLY_LIVE !== "1")("checks a public Apple BR edition through the weekly catalog adapter", async () => {
  const catalog = new ItunesCatalogAdapter({ country: "BR" });
  const start = performance.now();
  const edition = await catalog.lookupEdition("1440719294");
  if (!edition) throw new Error("The album was unavailable in the Apple BR lookup");
  expect(edition?.album).toMatchObject({ genre: "Jazz", trackCount: 5, storefront: "BR" });
  expect(edition?.tracks.map((track) => track.number)).toEqual([1, 2, 3, 4, 5]);
  const elapsedMs = Math.round(performance.now() - start);
  const releaseId = "82ae51a8-b718-4044-9c5d-42a6cbc86e9d";
  const musicBrainz = new MusicBrainzAdapter("ArcadiumFeasibility/1.0 ( https://github.com/kayoitalo/arcadium )");
  const release = await musicBrainz.releaseWithRecordingCredits(releaseId, 8_000);
  expect(release).toMatchObject({ id: releaseId });
  const checked = matchWeeklyRecordingCredits({ kind: "ALBUM", role: "BRIDGE", artistName: edition.album.artistName, family: "jazz",
    style: "Jazz", reason: "Caso de verificação pública.", reference: { provider: "catalog", url: null }, ...edition }, release, new Date().toISOString());
  report("weekly-apple-probe", { provenance: "OBSERVED_PUBLIC_CATALOG", collectionId: "1440719294", elapsedMs,
    tracks: edition.tracks.map(({ trackId, durationMs }) => ({ trackId, durationMs })), previewLinks: edition.tracks.filter((track) => track.previewUrl).length,
    musicBrainz: { releaseId, matchedCredits: checked.tracks.filter((track) => track.credit).length } });
}, 18_000);

it.skipIf(process.env.ARCADIUM_WEEKLY_LIVE !== "1" || !process.env.LASTFM_API_KEY)("checks three bounded Last.fm charts using the configured adapter", async () => {
  const lastFm = new LastFmSimilarArtistProvider();
  lastFm.beginDiscoveryWindow(12_000);
  const artist = await lastFm.getWeeklyAlbums("artist", "Cartola", 3);
  const tag = await lastFm.getWeeklyAlbums("tag", "dub", 3);
  const artists = await lastFm.getWeeklyArtists("jazz", 3);
  report("weekly-lastfm-probe", { provenance: "OBSERVED_PUBLIC_CATALOG", artistAlbums: artist.length, tagAlbums: tag.length,
    tagArtists: artists.length, diagnostics: lastFm.getDiagnostics() });
  expect(artist.length).toBeGreaterThan(0);
  expect(tag.length).toBeGreaterThan(0);
  expect(artists.length).toBeGreaterThan(0);
}, 18_000);
