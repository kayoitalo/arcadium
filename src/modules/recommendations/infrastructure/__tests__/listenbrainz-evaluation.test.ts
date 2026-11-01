import { describe, expect, it, vi } from 'vitest';
import { LISTENBRAINZ_ALGORITHM, parseListenBrainzCandidates } from '../listenbrainz-contract.mjs';
import { probeListenBrainz, probeOptions } from '../../../../../scripts/evaluation/listenbrainz-probe.mjs';
import { assessListenBrainz } from '../../../../../scripts/evaluation/listenbrainz-assess.mjs';

const seed = '8a49dba0-253a-4535-b87f-78bb035336ce';
const other = 'f3bba4cd-8018-468b-902e-bc8f029593e5';
const row = { recording_mbid: other, reference_mbid: seed, recording_name: 'Song (Live)', artist_credit_name: 'Band', score: 350 };
const response = (data: unknown, headers = {}) => new Response(JSON.stringify(data), { headers });

describe('ListenBrainz evaluation contract', () => {
  it('counts rejection reasons, preserves versions and keeps the first duplicate score', () => {
    const result = parseListenBrainzCandidates([row, { ...row, score: 999 }, { ...row, reference_mbid: other },
      { ...row, recording_mbid: seed }, { ...row, recording_name: ' ' }], seed);
    expect(result.counts).toEqual({ returnedRows: 5, invalidRows: 1, wrongReferenceRows: 1, selfRows: 1, duplicateRows: 1, validUniqueRows: 1, selectedRows: 1 });
    expect(result.candidates[0]).toMatchObject({ trackName: 'Song (Live)', rawScore: 350, algorithm: LISTENBRAINZ_ALGORITHM });
    expect(() => parseListenBrainzCandidates([{ unrelated: true }], seed)).toThrow();
    expect(() => parseListenBrainzCandidates({ error: true }, seed)).toThrow();
    expect(parseListenBrainzCandidates([], seed).counts.selectedRows).toBe(0);
  });

  it('counts unique candidates beyond the selection limit without expanding the adapter budget', () => {
    const rows = Array.from({ length: 25 }, (_, index) => ({ ...row, recording_mbid: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}` }));
    const result = parseListenBrainzCandidates(rows, seed.toUpperCase());
    expect(result.counts).toMatchObject({ validUniqueRows: 25, selectedRows: 20 });
    expect(result.candidates).toHaveLength(20);
  });

  it('defaults to zero network calls and validates the full request before execution', async () => {
    const request = vi.fn();
    const report = await probeListenBrainz(probeOptions([seed]), { fetch: request });
    expect(report.requestsStarted).toBe(0);
    expect(request).not.toHaveBeenCalled();
    expect(() => probeOptions([seed, seed.toUpperCase()])).toThrow();
    expect(() => probeOptions([seed, other, 'invalid'])).toThrow();
    expect(() => probeOptions([seed, other, seed, other])).toThrow();
    expect(() => probeOptions(['--unknown', seed])).toThrow();
  });

  it('uses the adapter algorithm and parser, and only reveals capped metadata explicitly', async () => {
    const request = vi.fn().mockResolvedValue(response([row, row]));
    const result = await probeListenBrainz(probeOptions(['--live', seed]), { fetch: request });
    const url = new URL(request.mock.calls[0][0]);
    expect(url.searchParams.get('algorithm')).toBe(LISTENBRAINZ_ALGORITHM);
    expect(result.report[0]).toMatchObject({ status: 'returned', returnedRows: 2, duplicateRows: 1, selectedRows: 1 });
    expect(result.report[0]).not.toHaveProperty('candidates');
    request.mockResolvedValue(response([row]));
    const shown = await probeListenBrainz(probeOptions(['--live', '--show-candidates', seed]), { fetch: request });
    const entry = shown.report[0];
    expect('candidates' in entry && entry.candidates?.[0]).toMatchObject({ rawScore: 350, review: { interest: 'not_heard' } });
  });

  it('spaces calls and stops on HTTP failure, contract failure or exhausted rate headers without retrying', async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const request = vi.fn().mockResolvedValueOnce(response([])).mockResolvedValueOnce(new Response('limited', { status: 429 }));
    const third = '00000000-0000-4000-8000-000000000003';
    const options = probeOptions(['--live', seed, other, third]);
    const limited = await probeListenBrainz(options, { fetch: request, sleep });
    expect(limited.requestsStarted).toBe(2);
    expect(sleep).toHaveBeenCalledWith(1100);
    expect(request).toHaveBeenCalledTimes(2);
    for (const result of [response([], { 'X-RateLimit-Remaining': '0' }), response({ error: true })]) {
      const fetchOnce = vi.fn().mockResolvedValue(result);
      expect((await probeListenBrainz(options, { fetch: fetchOnce, sleep })).requestsStarted).toBe(1);
      expect(fetchOnce).toHaveBeenCalledOnce();
    }
    const network = vi.fn().mockRejectedValue(new Error('private remote content'));
    const failed = await probeListenBrainz(options, { fetch: network, sleep });
    expect(JSON.stringify(failed)).not.toContain('private remote content');
    expect(network).toHaveBeenCalledOnce();
  });
});

describe('offline musical assessment', () => {
  const candidate = { recordingMbid: other, algorithm: LISTENBRAINZ_ALGORITHM, textOverlapWithBaseline: false };
  const snapshot = { baselineSessionId: 'private', baselineAlgorithm: 'v3-hybrid-2', candidates: [candidate], comparison: { total: 1, textOverlap: 0 } };

  it('keeps unheard judgments separate and never emits a personalized baseline ID', () => {
    const result = assessListenBrainz(snapshot);
    expect(result).toMatchObject({ withoutObservedTextOverlap: 1, adequacy: { reviewed: 0, fits: 0 }, interest: { reviewed: 0, interested: 0 } });
    expect(result).not.toHaveProperty('baselineSessionId');
    expect(result.limitation).toContain('not recording identity');
  });

  it('counts only explicit judgments, without turning curiosity into an implicit adequacy judgment', () => {
    const result = assessListenBrainz({ ...snapshot, candidates: [{ ...candidate, review: {
      adequacy: 'unreviewed', interest: 'interested', usefulSurprise: 'yes',
    } }] });
    expect(result.adequacy.reviewed).toBe(0);
    expect(result.interest).toEqual({ reviewed: 1, interested: 1, interestedWithoutTextOverlap: 1 });
    expect(result.usefulSurprise).toEqual({ reviewed: 1, yes: 1 });
  });

  it('refuses missing comparisons, mismatched algorithms, duplicate recordings and invalid judgments', () => {
    expect(() => assessListenBrainz({ ...snapshot, comparison: { total: 2, textOverlap: 0 } })).toThrow();
    expect(() => assessListenBrainz({ ...snapshot, candidates: [{ ...candidate, textOverlapWithBaseline: undefined }] })).toThrow();
    expect(() => assessListenBrainz({ ...snapshot, candidates: [{ ...candidate, algorithm: 'different' }] })).toThrow();
    expect(() => assessListenBrainz({ ...snapshot, candidates: [candidate, candidate], comparison: { total: 2, textOverlap: 0 } })).toThrow();
    expect(() => assessListenBrainz({ ...snapshot, candidates: [{ ...candidate, review: { interest: 'liked' } }] })).toThrow();
  });
});
