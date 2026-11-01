import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { LISTENBRAINZ_ALGORITHM, recordingMbidSchema } from '../../src/modules/recommendations/infrastructure/listenbrainz-contract.mjs';

const reviewSchema = z.object({
  adequacy: z.enum(['fits', 'misses', 'unreviewed']),
  interest: z.enum(['interested', 'not_interested', 'not_heard']),
  usefulSurprise: z.enum(['yes', 'no', 'unreviewed']),
});
const candidatesSchema = z.array(z.object({
  recordingMbid: recordingMbidSchema,
  algorithm: z.literal(LISTENBRAINZ_ALGORITHM),
  textOverlapWithBaseline: z.boolean().optional(),
  review: reviewSchema.optional(),
})).max(20).superRefine((items, ctx) => {
  if (new Set(items.map((item) => item.recordingMbid)).size !== items.length) ctx.addIssue({ code: 'custom', message: 'Duplicate recording' });
});
const snapshotSchema = z.object({
  baselineSessionId: z.string().min(1), baselineAlgorithm: z.string().min(1),
  candidates: candidatesSchema,
  comparison: z.object({ total: z.number().int(), textOverlap: z.number().int() }),
});

/** Offline assessment. Missing judgments remain missing, never negative.
 * @param {unknown} input
 */
export function assessListenBrainz(input) {
  const snapshot = snapshotSchema.parse(input);
  if (snapshot.comparison.total !== snapshot.candidates.length
    || snapshot.candidates.some((item) => item.textOverlapWithBaseline === undefined)
    || snapshot.comparison.textOverlap !== snapshot.candidates.filter((item) => item.textOverlapWithBaseline).length) {
    throw new Error('Incomplete or inconsistent baseline comparison');
  }
  const items = snapshot.candidates;
  const adequacyReviewed = items.filter((item) => item.review && item.review.adequacy !== 'unreviewed');
  const interestReviewed = items.filter((item) => item.review && item.review.interest !== 'not_heard');
  const surpriseReviewed = items.filter((item) => item.review && item.review.usefulSurprise !== 'unreviewed');
  return {
    algorithm: LISTENBRAINZ_ALGORITHM, baselineAlgorithm: snapshot.baselineAlgorithm,
    candidates: items.length, textOverlap: snapshot.comparison.textOverlap,
    withoutObservedTextOverlap: items.length - snapshot.comparison.textOverlap,
    adequacy: { reviewed: adequacyReviewed.length, fits: adequacyReviewed.filter((item) => item.review?.adequacy === 'fits').length },
    interest: { reviewed: interestReviewed.length, interested: interestReviewed.filter((item) => item.review?.interest === 'interested').length,
      interestedWithoutTextOverlap: interestReviewed.filter((item) => item.review?.interest === 'interested' && !item.textOverlapWithBaseline).length },
    usefulSurprise: { reviewed: surpriseReviewed.length, yes: surpriseReviewed.filter((item) => item.review?.usefulSurprise === 'yes').length },
    limitation: 'Text overlap is not recording identity or exclusive contribution to the full engine. Human judgments apply only to reviewed candidates. No automatic adoption decision.',
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw new Error('Missing snapshot');
    console.log(JSON.stringify(assessListenBrainz(JSON.parse(await readFile(process.argv[2], 'utf8'))), null, 2));
  } catch {
    console.error('Provide a local experiment API JSON snapshot, with optional candidate reviews. No network or database is used.');
    process.exitCode = 1;
  }
}
