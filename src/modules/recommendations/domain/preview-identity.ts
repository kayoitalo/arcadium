import { compatibleRecording } from "@/lib/music/recording-match";
import type { TrackPreview } from "./preview-provider.interface";

export function compatiblePreviewIdentity(
  value: unknown, expected: { artistName: string; trackName: string },
): TrackPreview["identity"] | null {
  if (!value || typeof value !== "object") return null;
  const identity = value as Record<string, unknown>;
  if (identity.source !== "itunes" || identity.match !== "compatible-text-v1"
    || typeof identity.sourceId !== "string" || !identity.sourceId
    || typeof identity.artistName !== "string" || typeof identity.trackName !== "string") return null;
  const typed = identity as NonNullable<TrackPreview["identity"]>;
  return compatibleRecording(expected, typed) ? typed : null;
}
