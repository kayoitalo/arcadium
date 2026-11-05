import { z } from "zod";
import type { RawCandidate } from "./recommendation.types";
import type { UserProfile } from "./taste-profile";
import { editionSummarySchema } from "./album-journey";
import { territorySnapshotSchema, repertoireRestrictionSchema, coverageSchema } from "./territories";

export const DISCOVERY_INTENTS = ["DISCOVER", "CONNECTIONS", "REPERTOIRE", "ALBUM", "TERRITORY"] as const;
export type DiscoveryIntent = typeof DISCOVERY_INTENTS[number];
const id = z.string().min(1).max(100);
export const discoveryContextSchema = z.object({
  version: z.literal(1), intent: z.enum(DISCOVERY_INTENTS),
  destination: territorySnapshotSchema.optional(), restrictions: repertoireRestrictionSchema.optional(),
  coverage: coverageSchema.optional(),
  journey: z.object({
    action: z.enum(["ENTRY", "MORE", "DEEPEN", "ALBUM"]),
    album: editionSummarySchema.optional(),
    rootSessionId: id.optional(), parentSessionId: id.optional(),
    anchor: z.object({ sourceSessionId: id, sourceItemId: id,
      artistName: z.string().min(1).max(500), trackName: z.string().min(1).max(1000) }).optional(),
  }),
}).superRefine((value, ctx) => {
  const album = value.intent === "ALBUM";
  if (album !== (value.journey.action === "ALBUM") || album !== Boolean(value.journey.album)) {
    ctx.addIssue({ code: "custom", message: "A jornada de álbum precisa da edição escolhida." });
  }
  if ((value.intent === "TERRITORY") !== Boolean(value.destination)) ctx.addIssue({ code: "custom", message: "O território precisa do destino registrado." });
  if (value.restrictions && value.intent !== "REPERTOIRE") ctx.addIssue({ code: "custom", message: "Restrições de repertório precisam dessa intenção." });
});
export type DiscoveryContext = z.infer<typeof discoveryContextSchema>;
export function readDiscoveryContext(value: unknown): DiscoveryContext | null {
  const parsed = discoveryContextSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Only observed listening events form the repertoire. Familiarity or curiosity
 * alone does not invent a listening event or a positive preference. */
export function repertoireCandidates(profile: UserProfile): RawCandidate[] {
  return (profile.longTerm?.tracks ?? []).filter((track) => track.plays > 0)
    .slice().sort((a, b) => b.plays - a.plays || a.trackName.localeCompare(b.trackName))
    .map((track, index) => ({ artistName: track.artistName, trackName: track.trackName,
      source: "history_repertoire", providerRank: index + 1,
      evidence: [{ kind: "history_repertoire", source: "history", playCount: track.plays,
        lastPlayedAt: track.lastPlayedAt }] }));
}
