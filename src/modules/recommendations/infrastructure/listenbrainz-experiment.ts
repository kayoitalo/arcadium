import { z } from "zod";

export const LISTENBRAINZ_ALGORITHM = "session_based_days_7500_session_300_contribution_5_threshold_15_limit_50_skip_30_top_n_listeners_1000";
const uuid = z.string().uuid();
const candidate = z.object({ recording_mbid: uuid, recording_name: z.string().min(1), artist_credit_name: z.string().min(1),
  reference_mbid: uuid, score: z.number().finite().nonnegative() });
export type ListenBrainzCandidate = { recordingMbid: string; trackName: string; artistName: string; source: "listenbrainz";
  referenceMbid: string; rawScore: number; algorithm: string };
const cache = new Map<string, { expires: number; candidates: ListenBrainzCandidate[] }>();
const pending = new Map<string, Promise<ListenBrainzCandidate[]>>();
let queue: Promise<unknown> = Promise.resolve();
let nextAt = 0;
let unavailableUntil = 0;

/** Explicit experimental lookup; never publishes listens or reads the user database. */
export class ListenBrainzExperiment {
  constructor(private enabled = process.env.ARCADIUM_LISTENBRAINZ_EXPERIMENT === "true") {}
  async candidates(recordingMbid: string): Promise<ListenBrainzCandidate[]> {
    if (!this.enabled) return [];
    uuid.parse(recordingMbid);
    const stored = cache.get(recordingMbid);
    if (stored && stored.expires > Date.now()) return stored.candidates;
    const running = pending.get(recordingMbid);
    if (running) return running;
    const task = queue.catch(() => undefined).then(async () => {
      if (Date.now() < unavailableUntil) throw new Error("ListenBrainz temporariamente indisponível");
      const wait = nextAt - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      nextAt = Date.now() + 1100;
      const params = new URLSearchParams({ recording_mbids: recordingMbid, algorithm: LISTENBRAINZ_ALGORITHM });
      const response = await fetch("https://labs.api.listenbrainz.org/similar-recordings/json?" + params, {
        headers: { "User-Agent": "Arcadium/0.1 (https://github.com/kayoitalo/arcadium)" }, signal: AbortSignal.timeout(10_000),
      });
      if (response.headers?.get("X-RateLimit-Remaining") === "0") {
        const reset = Number(response.headers.get("X-RateLimit-Reset-In"));
        unavailableUntil = Date.now() + Math.max(30_000, Number.isFinite(reset) ? reset * 1000 : 0);
      }
      if (!response.ok) {
        const seconds = Number(response.headers.get("Retry-After"));
        unavailableUntil = Date.now() + Math.max(30_000, Number.isFinite(seconds) ? seconds * 1000 : 0);
        throw new Error(`ListenBrainz HTTP ${response.status}`);
      }
      const rows = z.array(z.unknown()).parse(await response.json());
      const found = rows.map((row) => candidate.safeParse(row)).flatMap((row) => row.success ? [row.data] : []);
      const candidates = [...new Map(found.filter((row) => row.reference_mbid === recordingMbid && row.recording_mbid !== recordingMbid)
        .map((row) => [row.recording_mbid, { recordingMbid: row.recording_mbid, trackName: row.recording_name,
          artistName: row.artist_credit_name, source: "listenbrainz" as const, referenceMbid: recordingMbid,
          rawScore: row.score, algorithm: LISTENBRAINZ_ALGORITHM }])).values()].slice(0, 20);
      if (rows.length && !candidates.length) throw new Error("ListenBrainz retornou um contrato incompatível");
      cache.set(recordingMbid, { candidates, expires: Date.now() + 3_600_000 });
      return candidates;
    });
    queue = task; pending.set(recordingMbid, task);
    try { return await task; } finally { pending.delete(recordingMbid); }
  }
}
