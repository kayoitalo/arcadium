import { mkdirSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import { ItunesCatalogAdapter } from "../../src/modules/enrichment/infrastructure/itunes-catalog-adapter";
import { catalogTrackURL } from "../../src/modules/recommendations/domain/album-journey";
import { CARTOLA_1976, curatedRecordingCue, matchesCuratedEdition } from "../../src/modules/recommendations/domain/curated-albums";
import { prepareNarrativeComparison } from "../../src/modules/recommendations/domain/narrative-comparison";

it.skipIf(process.env.ARCADIUM_CURATED_LIVE !== "1")("verifies the published edition and prepares an observed editorial case", async () => {
  const catalog = new ItunesCatalogAdapter({ country: CARTOLA_1976.storefront });
  const start = performance.now();
  const edition = await catalog.lookupEdition(CARTOLA_1976.collectionId);
  const elapsedMs = Math.round(performance.now() - start);
  if (!matchesCuratedEdition(CARTOLA_1976, edition)) throw new Error("The public catalog did not confirm the ordered edition");
  const observations = edition.tracks.map((track) => ({
    trackId: track.trackId,
    rank: track.number,
    hasPreview: Boolean(track.previewUrl),
    hasRecordingLink: Boolean(catalogTrackURL(track.sourceUrl, track.trackId, edition.album.collectionId)),
    hasEditorialCue: Boolean(curatedRecordingCue(CARTOLA_1976, track)),
  }));
  expect(observations).toHaveLength(12);
  const cases = edition.tracks.flatMap((track) => {
    const cue = curatedRecordingCue(CARTOLA_1976, track);
    const recordingUrl = catalogTrackURL(track.sourceUrl, track.trackId, edition.album.collectionId);
    if (!cue || !recordingUrl) return [];
    const input = {
      id: `${CARTOLA_1976.credit.id}-${track.trackId}`, provenance: "OBSERVED_PUBLIC_FACTS", artistName: track.artistName, trackName: track.trackName,
      models: { lite: process.env.ARCADIUM_EVAL_LITE_MODEL || "Lite", flash: process.env.ARCADIUM_EVAL_FLASH_MODEL || "Flash" },
      evidence: [{ id: "credit", scope: "recording-credit", statement: cue.fact, sourceUrl: cue.source.url, checkedOn: cue.source.checkedOn,
        sourceId: track.trackId, recordingUrl }],
    };
    return [{ input, prepared: prepareNarrativeComparison(input) }];
  });
  expect(cases).toHaveLength(4);
  mkdirSync(".local/evaluation", { recursive: true });
  writeFileSync(".local/evaluation/curation-cartola.json", JSON.stringify({ provenance: "OBSERVED_PUBLIC_CATALOG", album: edition.album,
    catalogRequests: 1, elapsedMs, observations, cases, listeningJudgments: null }, null, 2));
  console.log(`Public lookup verified ${observations.length} tracks, ${observations.filter((row) => row.hasPreview).length} preview links and ${cases.length} recording-credit cases.`);
}, 15_000);
