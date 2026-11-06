import { z } from "zod";
import { createHash } from "node:crypto";
import { scoreAndRank } from "./scoring";
import { composeSession } from "./composition";
import { eligibleCandidates } from "./eligibility";
import { scoreAndRank as baselineRank } from "../evaluation/baseline-scoring";
import { composeSession as baselineCompose } from "../evaluation/baseline-composition";
import { eligibleCandidates as baselineEligible } from "../evaluation/baseline-eligibility";
import { trackFeedbackKey } from "./feedback";
import { isCollaborationOfKnownArtist } from "./candidate-filters";
import type { RawCandidate } from "./recommendation.types";
import type { UserProfile } from "./taste-profile";

const candidate = z.object({ artistName: z.string().min(1), trackName: z.string().min(1),
  source: z.enum(["similar_artist", "similar_track", "genre_adjacency", "artist_graph", "top_artist_deep_cut", "history_revisit", "history_repertoire", "territory_catalog"]),
  genre: z.string().optional(), listeners: z.number().nonnegative().optional(), providerRank: z.number().int().positive().optional(),
  trackId: z.string().optional(), match: z.number().optional(), isRevisit: z.boolean().optional(),
  evidence: z.array(z.object({ kind: z.enum(["artist_similarity", "track_similarity", "artist_catalog", "genre_overlap", "history_revisit", "history_repertoire", "territory_tag", "repertoire_metadata"]),
    source: z.enum(["lastfm", "catalog", "history"]), seedArtist: z.string().optional(), seedTrack: z.string().optional(), genre: z.string().optional(), rank: z.number().int().positive().optional(),
    region: z.enum(["long_term", "recent", "feedback"]).optional(), playCount: z.number().int().nonnegative().optional(), lastPlayedAt: z.string().datetime().optional() })).default([]),
});
const measured = z.object({ endToEndMs: z.number().nonnegative().nullable(), providerAttempts: z.number().int().nonnegative().nullable(),
  inputTokens: z.number().int().nonnegative().nullable(), outputTokens: z.number().int().nonnegative().nullable() });
export const evaluationCaseSchema = z.object({ version: z.literal(1), id: z.string().min(1), provenance: z.enum(["SYNTHETIC", "OBSERVED_SNAPSHOT"]),
  baseline: z.literal("v3-hybrid-3@6a9799c"), treatment: z.literal("v3-hybrid-4"), capturedAt: z.string().datetime(), size: z.number().int().min(1).max(20),
  request: z.object({ intent: z.enum(["DISCOVER", "TERRITORY", "REPERTOIRE"]), genre: z.string().optional() }),
  profile: z.object({ knownArtists: z.array(z.string()), knownTracks: z.array(z.object({ artistName: z.string(), trackName: z.string() })), topGenres: z.array(z.string()) }),
  pools: z.object({ baseline: z.array(candidate).max(500), treatment: z.array(candidate).max(500) }),
  measurements: z.object({ baseline: measured, treatment: measured }),
  judgments: z.array(z.object({ engine: z.enum(["baseline", "treatment"]), key: z.string(), adequate: z.boolean().nullable(), interesting: z.boolean().nullable(), usefulSurprise: z.boolean().nullable() })).default([]),
}).strict().superRefine((value, ctx) => {
  if (value.provenance === "SYNTHETIC" && value.judgments.length) ctx.addIssue({ code: "custom", message: "Synthetic cases cannot carry real taste judgments." });
  if (value.request.intent === "TERRITORY" && !value.request.genre) ctx.addIssue({ code: "custom", message: "A territory evaluation needs its destination." });
  if (new Set(value.judgments.map((row) => JSON.stringify([row.engine, row.key]))).size !== value.judgments.length) ctx.addIssue({ code: "custom", message: "Duplicate judgments." });
});
export type EvaluationCase = z.infer<typeof evaluationCaseSchema>;
const mean = (values: boolean[]) => values.length ? values.filter(Boolean).length / values.length : null;
const ratio = (n: number, d: number) => d ? n / d : null;
export function evaluateDiscovery(input: unknown) {
  const value = evaluationCaseSchema.parse(input);
  const profile: UserProfile = { topArtistNames: [], topGenres: value.profile.topGenres, knownArtistNames: new Set(value.profile.knownArtists.map((name) => name.toLowerCase())), referenceTime: value.capturedAt,
    knownTrackKeys: new Set(value.profile.knownTracks.map((row) => row.artistName.toLowerCase() + "|" + row.trackName.toLowerCase())), feedbackMap: new Map(), totalPlays: 0, uniqueArtists: value.profile.knownArtists.length };
  const engines = {} as Record<"baseline" | "treatment", ReturnType<typeof run>>;
  function run(engine: "baseline" | "treatment") {
    const started = performance.now();
    // Baseline source is frozen at the merge commit in baseline-manifest.json.
    // Paired pools capture generation; this is not an online full-engine run.
    const raw: RawCandidate[] = value.pools[engine];
    const allowKnown = engine === "treatment" && value.request.intent === "REPERTOIRE";
    const scoped = engine === "treatment" && value.request.intent === "TERRITORY" ? raw.filter((item) => !isCollaborationOfKnownArtist(item.artistName, profile.knownArtistNames)
      && item.evidence?.some((row) => row.kind === "territory_tag" && row.genre === value.request.genre)) : raw;
    const eligible = engine === "baseline" ? baselineEligible(scoped, profile, new Set()) : eligibleCandidates(scoped, profile, new Set(), allowKnown);
    const selected = engine === "baseline" ? baselineCompose(baselineRank(eligible, profile, "BALANCED"), value.size)
      : composeSession(scoreAndRank(eligible, profile, "BALANCED"), value.size);
    const rankingMs = performance.now() - started;
    const keys = selected.map((item) => trackFeedbackKey(item.artistName, item.trackName));
    const judgments = value.judgments.filter((row) => row.engine === engine && keys.includes(row.key));
    const human = Object.fromEntries((["adequate", "interesting", "usefulSurprise"] as const).map((metric) => {
      const observed = judgments.flatMap((row) => row[metric] === null ? [] : [row[metric]!]);
      return [metric, { rate: mean(observed), judged: observed.length, unjudged: selected.length - observed.length }];
    }));
    return { selected: keys, metrics: { coverage: selected.length / value.size,
      artistDiversity: ratio(new Set(selected.map((row) => row.artistName.toLowerCase())).size, selected.length),
      genreCount: new Set(selected.flatMap((row) => (row.genre ?? "").split(/\s*[/,]\s*/).filter(Boolean))).size,
      evidenceCoverage: ratio(selected.filter((row) => row.evidence?.length).length, selected.length),
      unseenArtistShare: ratio(selected.filter((row) => !profile.knownArtistNames.has(row.artistName.toLowerCase())).length, selected.length),
      destinationAdherence: value.request.intent === "TERRITORY" ? mean(selected.map((row) => Boolean(row.evidence?.some((entry) => entry.kind === "territory_tag" && entry.genre === value.request.genre)))) : null,
      eligible: eligible.length, poolSize: raw.length, rankingReplayMs: rankingMs, measurements: value.measurements[engine], human } };
  }
  engines.baseline = run("baseline"); engines.treatment = run("treatment");
  return { version: 1, id: value.id, provenance: value.provenance, baseline: value.baseline, treatment: value.treatment,
    inputHash: createHash("sha256").update(JSON.stringify(value)).digest("hex"), engines,
    overlapWithBaseline: ratio(engines.treatment.selected.filter((key) => engines.baseline.selected.includes(key)).length, engines.treatment.selected.length),
    limitation: "Paired candidate-pool replay using shared ranking weights. Ranking time is local; end-to-end latency, consumption and taste require observed measurements. Unseen artist is not useful surprise. No exposure/play/full-listening inference; ListenBrainz remains outside ranking." };
}
