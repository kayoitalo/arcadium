import { describe, it, expect } from "vitest";
import { buildListeningCues } from "./listening-cues";
import { CARTOLA_1976, curatedRecordingCue } from "./curated-albums";
const item = () => ({ artistName: "Synthetic", trackName: "Song (Live)", appleMusicUrl: "https://music.apple.com/br/album/example/42?i=43",
  scoreComponents: { previewIdentity: { source: "itunes", sourceId: "43", artistName: "Synthetic", trackName: "Song (Live)", match: "compatible-text-v1" },
    catalogFacts: { durationMs: 185000, fetchedAt: "2026-11-04T00:00:00Z" } } });
describe("recording-scoped factual listening invitations", () => {
  it("reuses catalog facts without AI, audio analysis or sonic claims", () => {
    const result = buildListeningCues(item());
    expect(result.status).toBe("AVAILABLE"); expect(result.cues.map((cue) => cue.kind)).toEqual(["DURATION", "VERSION_LABEL"]);
    expect(result.cues[0].fact).toContain("3:05"); expect(result.cues.every((cue) => cue.source.sourceId === "43" && cue.source.scope === "catalog-track")).toBe(true);
    expect(buildListeningCues(item())).toEqual(result);
  });
  it("never turns artist/album wiki or mismatched media into a recording-level cue", () => {
    for (const changed of [
      { ...item(), trackName: "Song (Remix)" }, { ...item(), appleMusicUrl: "https://evil.test/43" },
      { ...item(), appleMusicUrl: "https://music.apple.com/br/album/example/42?i=999" },
      { ...item(), appleMusicUrl: "https://www.apple.com/support?i=43" },
      { ...item(), scoreComponents: { culturalContext: { kind: "album", text: "Invented instrument" } } },
      { ...item(), scoreComponents: { ...item().scoreComponents, catalogFacts: { durationMs: -2, fetchedAt: "bad" } } },
    ]) expect(buildListeningCues(changed).status).toBe("INSUFFICIENT_EVIDENCE");
  });

  it("shows editorial credit only when the stored edition and trusted track link agree", () => {
    const { collectionId, storefront, artistName, albumName, trackIds } = CARTOLA_1976;
    const trackId = trackIds[0]; const trackName = "O Mundo É um Moinho";
    const appleMusicUrl = `https://music.apple.com/br/album/${collectionId}?i=${trackId}`;
    const albumEdition = { collectionId, storefront, artistName, albumName, trackId, disc: 1, number: 1, provider: "itunes",
      trackCount: 12, sourceUrl: `https://music.apple.com/br/album/${collectionId}`, artworkUrl: null, releaseDate: null, fetchedAt: "2026-11-05T12:00:00Z" };
    const recordingCue = curatedRecordingCue(CARTOLA_1976, { trackId, trackName, artistName, disc: 1, number: 1, durationMs: null, previewUrl: null, sourceUrl: appleMusicUrl });
    const row = { artistName, trackName, appleMusicUrl, scoreComponents: { albumEdition, recordingCue,
      catalogFacts: { durationMs: 180_000, fetchedAt: albumEdition.fetchedAt },
      previewIdentity: { source: "itunes", sourceId: trackId, artistName, trackName, match: "compatible-text-v1" } } };
    expect(buildListeningCues(row).cues[0]).toMatchObject({ kind: "RECORDING_CREDIT", source: { scope: "recording-credit", collectionId } });
    const changed = { ...row, appleMusicUrl: `https://music.apple.com/br/album/42?i=${trackId}` };
    expect(buildListeningCues(changed).cues.map((cue) => cue.kind)).not.toContain("RECORDING_CREDIT");
    expect(buildListeningCues({ ...row, trackName: `${trackName} (Ao vivo)` }).status).toBe("INSUFFICIENT_EVIDENCE");
  });
});
