import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

// Read-only public catalog probes. No Gemini, listening history or authenticated mutations.
const { values } = parseArgs({ options: {
  live: { type: "boolean", default: false },
  provider: { type: "string", default: "lastfm" },
  "max-requests": { type: "string", default: "5" },
  offset: { type: "string", default: "0" },
} });
const limit = Number(values["max-requests"]);
const offset = Number(values.offset);
if (!Number.isInteger(limit) || limit < 1 || limit > 60 || !Number.isInteger(offset) || offset < 0) {
  throw new Error("Use max-requests 1..60 and a nonnegative offset");
}
if (!["lastfm", "itunes"].includes(values.provider)) throw new Error("Provider must be lastfm or itunes");
const cases = JSON.parse(await readFile(new URL("./cases.json", import.meta.url), "utf8"));
const report = { schemaVersion: 1, suite: "catalog-30-v1", startedAt: new Date().toISOString(), provider: values.provider,
  live: values.live, requestLimit: limit, requests: 0, cases: cases.length, offset, results: [] };
if (values.live && values.provider === "lastfm" && !process.env.LASTFM_API_KEY) {
  throw new Error("LASTFM_API_KEY is required for live Last.fm probes");
}
if (values.live) {
  for (const item of cases.slice(offset)) {
    if (report.requests >= limit) break;
    const query = values.provider === "lastfm"
      ? new URLSearchParams({ method: "track.getsimilar", artist: item.artist, track: item.track, api_key: process.env.LASTFM_API_KEY, format: "json", limit: "10" })
      : new URLSearchParams({ term: `${item.artist} ${item.track}`, entity: "song", country: "BR", limit: "10" });
    const base = values.provider === "lastfm" ? "https://ws.audioscrobbler.com/2.0/" : "https://itunes.apple.com/search";
    const started = Date.now();
    report.requests++;
    try {
      const response = await fetch(`${base}?${query}`, { headers: { "User-Agent": process.env.LASTFM_USER_AGENT || "ArcadiumEvaluation/1.0" }, signal: AbortSignal.timeout(10000) });
      if (!response.ok) {
        report.results.push({ id: item.id, category: item.category, status: `http_${response.status}`, latencyMs: Date.now() - started });
        if ([429, 503].includes(response.status)) break;
      } else {
        const data = await response.json();
        if (data.error) {
          report.results.push({ id: item.id, category: item.category, status: "provider_error", code: Number(data.error), latencyMs: Date.now() - started });
          break;
        }
        const candidates = values.provider === "lastfm" ? data.similartracks?.track : data.results;
        report.results.push({ id: item.id, category: item.category, status: "ok", returned: Array.isArray(candidates) ? candidates.length : 0,
          // Returned search rows are not confirmed identity or recommendations of adequate quality.
          withPreview: values.provider === "itunes" && Array.isArray(candidates) ? candidates.filter(x => x.previewUrl).length : null,
          identityVerified: false, musicalQualityEvaluated: false, latencyMs: Date.now() - started });
      }
    } catch {
      // Do not print request URLs or provider error text: either can contain credentials.
      report.results.push({ id: item.id, category: item.category, status: "request_failed", latencyMs: Date.now() - started });
      break;
    }
    if (report.requests < limit) await new Promise(resolve => setTimeout(resolve, values.provider === "itunes" ? 3200 : 1200));
  }
}
console.log(JSON.stringify(report, null, 2));
if (report.results.some(x => x.status !== "ok")) process.exitCode = 1;
