import { z } from "zod";
import { spotifyFetch, SpotifyUnavailable } from "./spotify-http";

// Server-only application token; never stored in the DB or sent to the browser.
let saved: { clientId: string; secret: string; token: string; expires: number } | null = null;
let pending: Promise<string> | null = null;
const tokenSchema = z.object({ access_token: z.string().min(1), token_type: z.literal("Bearer"), expires_in: z.number().positive().max(86400) });
export function isSpotifyCatalogConfigured() {
  return Boolean(process.env.SPOTIFY_CLIENT_ID?.trim() && process.env.SPOTIFY_CLIENT_SECRET?.trim());
}
export function invalidateSpotifyCatalogToken() { saved = null; }
export async function spotifyCatalogToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim() ?? "";
  const secret = process.env.SPOTIFY_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !secret) throw new SpotifyUnavailable();
  if (saved?.clientId === clientId && saved.secret === secret && saved.expires > Date.now()) return saved.token;
  if (pending) return pending;
  pending = (async () => {
    const response = await spotifyFetch("https://accounts.spotify.com/api/token", {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(6000),
      headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "client_credentials" }),
    });
    if (!response.ok) throw new SpotifyUnavailable();
    const parsed = tokenSchema.safeParse(await response.json());
    if (!parsed.success) throw new SpotifyUnavailable();
    saved = { clientId, secret, token: parsed.data.access_token, expires: Date.now() + parsed.data.expires_in * 900 };
    return saved.token;
  })();
  try { return await pending; } finally { pending = null; }
}
