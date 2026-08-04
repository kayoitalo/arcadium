import crypto from "crypto";
import { normalizeText } from "./normalization";

/**
 * Generates a deterministic unique SHA-256 key for a listening event.
 * Used for database-level deduplication constraint.
 */
export function generateProviderEventKey(
  userId: string,
  provider: string,
  playedAtUtcSeconds: number,
  rawArtistName: string,
  rawTrackName: string
): string {
  const normArtist = normalizeText(rawArtistName);
  const normTrack = normalizeText(rawTrackName);
  const rawKeyString = `${userId}|${provider.toLowerCase()}|${playedAtUtcSeconds}|${normArtist}|${normTrack}`;
  
  return crypto.createHash("sha256").update(rawKeyString).digest("hex");
}
