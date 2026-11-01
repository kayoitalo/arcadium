import { z } from "zod";

// Shared by the opt-in adapter and the manual evaluator; never calibrate this score.
export const LISTENBRAINZ_ALGORITHM = "session_based_days_7500_session_300_contribution_5_threshold_15_limit_50_skip_30_top_n_listeners_1000";
export const LISTENBRAINZ_MAX_CANDIDATES = 20;
export const recordingMbidSchema = z.string().uuid().transform((id) => id.toLowerCase());
const rowSchema = z.object({
  recording_mbid: recordingMbidSchema,
  recording_name: z.string().trim().min(1),
  artist_credit_name: z.string().trim().min(1),
  reference_mbid: recordingMbidSchema,
  score: z.number().finite().nonnegative(),
});

/** @param {unknown} payload @param {string} referenceMbid */
export function parseListenBrainzCandidates(payload, referenceMbid) {
  const reference = recordingMbidSchema.parse(referenceMbid);
  const rows = z.array(z.unknown()).parse(payload);
  const counts = { returnedRows: rows.length, invalidRows: 0, wrongReferenceRows: 0, selfRows: 0, duplicateRows: 0, validUniqueRows: 0, selectedRows: 0 };
  const seen = new Set();
  const candidates = [];
  for (const value of rows) {
    const parsed = rowSchema.safeParse(value);
    if (!parsed.success) { counts.invalidRows++; continue; }
    const row = parsed.data;
    if (row.reference_mbid !== reference) { counts.wrongReferenceRows++; continue; }
    if (row.recording_mbid === reference) { counts.selfRows++; continue; }
    if (seen.has(row.recording_mbid)) { counts.duplicateRows++; continue; }
    seen.add(row.recording_mbid);
    counts.validUniqueRows++;
    // Preserve provider order and the first occurrence; do not sort by raw score.
    if (candidates.length < LISTENBRAINZ_MAX_CANDIDATES) candidates.push({
      recordingMbid: row.recording_mbid, trackName: row.recording_name,
      artistName: row.artist_credit_name, source: /** @type {"listenbrainz"} */ ("listenbrainz"),
      referenceMbid: reference, rawScore: row.score, algorithm: LISTENBRAINZ_ALGORITHM,
    });
  }
  if (rows.length && !candidates.length) throw new Error("ListenBrainz retornou um contrato incompatível");
  counts.selectedRows = candidates.length;
  return { candidates, counts };
}
