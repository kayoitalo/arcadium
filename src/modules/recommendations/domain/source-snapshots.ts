import { albumTrackEditionSchema } from "./album-journey";
import { readCulturalContexts } from "./cultural-context";
import { buildListeningCues } from "./listening-cues";
/** Public provenance only; do not export ranking diagnostics or provider payloads. */
export function sourceSnapshots(value: unknown, item?: { artistName: string; trackName: string; appleMusicUrl?: string | null }) {
  const components = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const album = albumTrackEditionSchema.safeParse(components.albumEdition);
  const cues = item ? buildListeningCues({ ...item, scoreComponents: components }) : null;
  return { albumEdition: album.success ? album.data : null, culturalContext: readCulturalContexts(components.culturalContext),
    ...(cues?.status === "AVAILABLE" ? { listeningCues: cues } : {}) };
}
