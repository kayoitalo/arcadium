// Shared by catalog photos, playlist operations and OAuth in this process.
// Spotify does not publish one universal numeric quota. Honor its actual 429.
let unavailableUntil = 0;
export class SpotifyUnavailable extends Error {
  constructor() { super("Spotify temporariamente indisponível."); }
}
export function assertSpotifyAvailable() {
  if (unavailableUntil > Date.now()) throw new SpotifyUnavailable();
}
export async function spotifyFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  assertSpotifyAvailable();
  const response = await fetch(input, init);
  if (response.status === 429) {
    const retry = response.headers.get("retry-after");
    const seconds = retry?.trim() ? Number(retry) : NaN;
    const delay = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : Date.parse(retry ?? "") - Date.now();
    unavailableUntil = Date.now() + Math.max(30_000, Number.isFinite(delay) ? delay : 60_000);
  }
  return response;
}
