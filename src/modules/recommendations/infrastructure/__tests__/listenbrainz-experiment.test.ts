import { afterEach, describe, expect, it, vi } from "vitest";
import { ListenBrainzExperiment } from "../listenbrainz-experiment";
afterEach(() => vi.unstubAllGlobals());
const seed = "8a49dba0-253a-4535-b87f-78bb035336ce";
describe("isolated ListenBrainz experiment", () => {
  it("makes no calls when disabled", async () => {
    vi.stubGlobal("fetch", vi.fn());
    expect(await new ListenBrainzExperiment(false).candidates(seed)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("checks recording provenance, deduplicates and preserves provider score without calibration", async () => {
    const row = { recording_mbid: "f3bba4cd-8018-468b-902e-bc8f029593e5", recording_name: "Example", artist_credit_name: "Artist", reference_mbid: seed, score: 350 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [row, row, { ...row, reference_mbid: row.recording_mbid }] }));
    const service = new ListenBrainzExperiment(true);
    const [one, two] = await Promise.all([service.candidates(seed), service.candidates(seed)]);
    expect(one).toHaveLength(1); expect(one[0].rawScore).toBe(350); expect(one[0].source).toBe("listenbrainz");
    expect(two).toEqual(one); expect(fetch).toHaveBeenCalledOnce();
  });
});
