import { getValidAccessToken, grantsLibrary, markNeedsReauth } from "./spotify-connection";
import { spotifyFetch } from "../infrastructure/spotify-http";

export interface SavedTrack { artistName: string; trackName: string; addedAt: string | null }

type RawSaved = { added_at?: string; track?: { name?: string; artists?: Array<{ name?: string }> } | null };

/** Lê GET /me/tracks: as Curtidas, da mais recente pra trás. Item sem faixa (removida do catálogo) fica de fora. */
export function readSavedTracks(payload: unknown): SavedTrack[] {
  const items = (payload as { items?: RawSaved[] })?.items ?? [];
  return items.flatMap((item) => {
    const artistName = item.track?.artists?.[0]?.name;
    const trackName = item.track?.name;
    return artistName && trackName ? [{ artistName, trackName, addedAt: item.added_at ?? null }] : [];
  });
}

const cache = new Map<string, { at: number; value: SavedTrack[] }>();
/** As Curtidas mudam devagar: uma consulta a cada seis horas por conta. */
const TTL_MS = 6 * 60 * 60 * 1000;

/**
 * As 50 Curtidas mais recentes. Sem conexão, sem a permissão (conexão de
 * antes das Curtidas) ou com falha: lista vazia — o Descobrir segue com o
 * resto. Token recusado (401) marca a conexão pra reconectar.
 */
export async function loadSavedTracks(userId: string, now = Date.now()): Promise<SavedTrack[]> {
  const hit = cache.get(userId);
  if (hit && now - hit.at < TTL_MS) return hit.value;
  const token = await getValidAccessToken(userId);
  if (!token || !grantsLibrary(token.scope)) return [];
  const response = await spotifyFetch("https://api.spotify.com/v1/me/tracks?limit=50", {
    headers: { Authorization: `Bearer ${token.accessToken}` },
    signal: AbortSignal.timeout(4_000),
    cache: "no-store",
  });
  if (response.status === 401) { await markNeedsReauth(userId); return []; }
  if (!response.ok) {
    // 403 aqui é o modo de desenvolvimento do Spotify barrando o endpoint: vale saber no log
    console.warn(`[Spotify] Curtidas indisponíveis: HTTP ${response.status}`);
    return [];
  }
  const value = readSavedTracks(await response.json());
  cache.set(userId, { at: now, value });
  return value;
}
