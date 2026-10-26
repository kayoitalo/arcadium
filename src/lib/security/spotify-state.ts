// Each flow has its own short-lived cookie, so parallel tabs cannot replace it.
export function spotifyStateCookie(state: string): string | null {
  return /^[A-Za-z0-9_-]{32}$/.test(state) ? `spotify_oauth_${state}` : null;
}
