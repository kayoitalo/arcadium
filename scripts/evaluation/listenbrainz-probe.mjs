// Manual, opt-in public lookup. Never reads or uploads the listening database.
const mbids = process.argv.slice(2);
if (!mbids.length || mbids.length > 3 || mbids.some((id) => !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id))) {
  throw new Error('Pass one to three verified MusicBrainz recording MBIDs. Artist/release IDs are not valid seeds.');
}
const algorithm = 'session_based_days_180_session_300_contribution_5_threshold_15_limit_50_skip_30';
const report = [];
for (const recording_mbid of mbids) {
  if (report.length) await new Promise((resolve) => setTimeout(resolve, 1100));
  const started = Date.now();
  try {
    const query = new URLSearchParams({ recording_mbids: recording_mbid, algorithm });
    const response = await fetch('https://labs.api.listenbrainz.org/similar-recordings/json?' + query, {
      headers: { 'User-Agent': 'Arcadium/0.1 (manual discovery evaluation)' }, signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) { report.push({ recording_mbid, status: response.status, elapsedMs: Date.now() - started }); break; }
    const data = await response.json();
    report.push({ recording_mbid, status: 200, validArray: Array.isArray(data), candidateCount: Array.isArray(data) ? data.length : null, elapsedMs: Date.now() - started });
  } catch (error) { report.push({ recording_mbid, error: error.name, elapsedMs: Date.now() - started }); break; }
}
console.log(JSON.stringify({ algorithm, source: 'ListenBrainz Labs', scope: 'coverage probe only; no relevance or ranking claim', report }, null, 2));
