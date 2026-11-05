import { albumTrackEditionSchema } from "./album-journey";
import { readCulturalContexts } from "./cultural-context";
/** Public provenance only; do not export ranking diagnostics or provider payloads. */
export function sourceSnapshots(value: unknown) {
  const components = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const album = albumTrackEditionSchema.safeParse(components.albumEdition);
  return { albumEdition: album.success ? album.data : null, culturalContext: readCulturalContexts(components.culturalContext) };
}
