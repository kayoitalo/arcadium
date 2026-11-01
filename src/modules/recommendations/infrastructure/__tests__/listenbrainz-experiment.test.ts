import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-01T12:00:00Z')); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
const seed = "8a49dba0-253a-4535-b87f-78bb035336ce";
describe("isolated ListenBrainz experiment", () => {
  it("makes no calls when disabled", async () => {
    const { ListenBrainzExperiment } = await import('../listenbrainz-experiment');
    vi.stubGlobal("fetch", vi.fn());
    expect(await new ListenBrainzExperiment(false).candidates(seed)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("checks recording provenance, deduplicates and preserves provider score without calibration", async () => {
    const { ListenBrainzExperiment } = await import('../listenbrainz-experiment');
    const row = { recording_mbid: "f3bba4cd-8018-468b-902e-bc8f029593e5", recording_name: "Example", artist_credit_name: "Artist", reference_mbid: seed, score: 350 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [row, row, { ...row, reference_mbid: row.recording_mbid }] }));
    const service = new ListenBrainzExperiment(true);
    const [one, two] = await Promise.all([service.candidates(seed), service.candidates(seed)]);
    expect(one).toHaveLength(1); expect(one[0].rawScore).toBe(350); expect(one[0].source).toBe("listenbrainz");
    expect(two).toEqual(one); expect(fetch).toHaveBeenCalledOnce();
  });

  it('normalizes seed casing for provenance, coalescing and cache reuse', async () => {
    const { ListenBrainzExperiment } = await import('../listenbrainz-experiment');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    const service = new ListenBrainzExperiment(true);
    await Promise.all([service.candidates(seed.toUpperCase()), service.candidates(seed)]);
    await service.candidates(seed);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('bounds the cache and expires results after an hour', async () => {
    const { ListenBrainzExperiment, LISTENBRAINZ_CACHE_LIMIT } = await import('../listenbrainz-experiment');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    const service = new ListenBrainzExperiment(true);
    const id = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
    const lookup = async (mbid: string) => {
      const task = service.candidates(mbid);
      await vi.runAllTimersAsync();
      return task;
    };
    for (let index = 0; index <= LISTENBRAINZ_CACHE_LIMIT; index++) await lookup(id(index));
    expect(fetch).toHaveBeenCalledTimes(LISTENBRAINZ_CACHE_LIMIT + 1);
    await lookup(id(LISTENBRAINZ_CACHE_LIMIT));
    expect(fetch).toHaveBeenCalledTimes(LISTENBRAINZ_CACHE_LIMIT + 1);
    await lookup(id(0)); // oldest entry was evicted
    expect(fetch).toHaveBeenCalledTimes(LISTENBRAINZ_CACHE_LIMIT + 2);
    vi.advanceTimersByTime(3_600_000);
    await lookup(id(LISTENBRAINZ_CACHE_LIMIT));
    expect(fetch).toHaveBeenCalledTimes(LISTENBRAINZ_CACHE_LIMIT + 3);
  });
});
