import { pathToFileURL } from 'node:url';
import { LISTENBRAINZ_ALGORITHM, parseListenBrainzCandidates, recordingMbidSchema } from '../../src/modules/recommendations/infrastructure/listenbrainz-contract.mjs';

/** @param {string[]} args */
export function probeOptions(args) {
  const live = args.includes('--live');
  const showCandidates = args.includes('--show-candidates');
  if (args.some((arg) => arg.startsWith('--') && !['--live', '--show-candidates'].includes(arg))) throw new Error('Unknown option');
  const mbids = args.filter((arg) => !arg.startsWith('--')).map((id) => recordingMbidSchema.parse(id));
  if (!mbids.length || mbids.length > 3 || new Set(mbids).size !== mbids.length) {
    throw new Error('Pass one to three distinct, verified recording MBIDs; artist/release IDs are not valid seeds.');
  }
  return { live, showCandidates, mbids };
}

/** Manual public queries only. Does not load environment files, credentials or the database.
 * @param {ReturnType<typeof probeOptions>} options
 * @param {{ fetch?: typeof globalThis.fetch, sleep?: (ms: number) => Promise<void>, now?: () => number }} dependencies
 */
export async function probeListenBrainz(options, dependencies = {}) {
  const request = dependencies.fetch ?? globalThis.fetch;
  const sleep = dependencies.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const now = dependencies.now ?? Date.now;
  const report = [];
  let requestsStarted = 0;
  let stopReason = null;
  for (const recordingMbid of options.mbids) {
    if (!options.live) { report.push({ recordingMbid, status: 'planned' }); continue; }
    if (requestsStarted) await sleep(1100);
    const started = now();
    requestsStarted++;
    try {
      const query = new URLSearchParams({ recording_mbids: recordingMbid, algorithm: LISTENBRAINZ_ALGORITHM });
      const response = await request('https://labs.api.listenbrainz.org/similar-recordings/json?' + query, {
        headers: { 'User-Agent': 'Arcadium/0.1 (https://github.com/kayoitalo/arcadium)' }, signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        report.push({ recordingMbid, status: 'http-error', httpStatus: response.status, elapsedMs: now() - started });
        stopReason = 'http-error';
        break;
      }
      const { candidates, counts } = parseListenBrainzCandidates(await response.json(), recordingMbid);
      report.push({ recordingMbid, status: candidates.length ? 'returned' : 'empty', httpStatus: response.status,
        elapsedMs: now() - started, ...counts,
        ...(options.showCandidates ? { candidates: candidates.map((item) => ({ ...item,
          review: { adequacy: 'unreviewed', interest: 'not_heard', usefulSurprise: 'unreviewed' } })) } : {}),
      });
      if (response.headers.get('X-RateLimit-Remaining') === '0') { stopReason = 'rate-limit'; break; }
    } catch {
      report.push({ recordingMbid, status: 'network-or-contract-error', elapsedMs: now() - started });
      stopReason = 'network-or-contract-error';
      break;
    }
  }
  return { algorithm: LISTENBRAINZ_ALGORITHM, source: 'ListenBrainz Labs', mode: options.live ? 'live' : 'dry-run',
    observedAt: new Date(now()).toISOString(), requestedSeeds: options.mbids.length, requestsStarted, stopReason,
    completedSeeds: report.filter((item) => ['returned', 'empty'].includes(item.status)).length,
    scope: 'Public coverage only; no baseline comparison, personalized relevance or ranking claim.', report };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await probeListenBrainz(probeOptions(process.argv.slice(2)));
    console.log(JSON.stringify(result, null, 2));
    if (result.report.some((item) => item.status.endsWith('error'))) process.exitCode = 1;
  } catch {
    console.error('Usage: node scripts/evaluation/listenbrainz-probe.mjs [--live] [--show-candidates] <recording-mbid> [up to 3 distinct seeds]');
    process.exitCode = 1;
  }
}
