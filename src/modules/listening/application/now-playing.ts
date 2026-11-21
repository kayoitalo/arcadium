import { prisma } from "@/lib/db/prisma";

/** O que está tocando agora no Last.fm, se estiver. */
export interface NowPlaying {
  track: string;
  artist: string;
  album: string | null;
  coverUrl: string | null;
}

type RecentTrack = {
  name?: string;
  artist?: { "#text"?: string; name?: string };
  album?: { "#text"?: string };
  image?: Array<{ size?: string; "#text"?: string }>;
  "@attr"?: { nowplaying?: string };
};

/** Lê a primeira faixa de user.getrecenttracks: só vale se o Last.fm a marcar como tocando agora. */
export function readNowPlaying(payload: unknown): NowPlaying | null {
  const raw = (payload as { recenttracks?: { track?: RecentTrack | RecentTrack[] } })?.recenttracks?.track;
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (!first || first["@attr"]?.nowplaying !== "true" || !first.name) return null;
  const artist = first.artist?.["#text"] || first.artist?.name;
  if (!artist) return null;
  const images = first.image ?? [];
  const cover = [...images].reverse().find((image) => image["#text"])?.["#text"] ?? null;
  // a estrela cinza do Last.fm é "sem capa", não capa
  const coverUrl = cover && !cover.includes("2a96cbd8b46e442fc41c2b86b821562f") ? cover : null;
  return { track: first.name, artist, album: first.album?.["#text"] || null, coverUrl };
}

const cache = new Map<string, { at: number; value: NowPlaying | null }>();
/** Uma consulta por minuto por conta, no máximo: a tela pergunta de minuto em minuto. */
const TTL_MS = 45_000;

/**
 * O "tocando agora" do Last.fm, que a sincronização sempre descartou (ela
 * só grava o que terminou de tocar). Consulta leve: uma faixa, sem retentar,
 * com prazo curto. Falhou, a tela só não mostra.
 */
export async function loadNowPlaying(userId: string, now = Date.now()): Promise<NowPlaying | null> {
  const hit = cache.get(userId);
  if (hit && now - hit.at < TTL_MS) return hit.value;
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return null;
  const connection = await prisma.providerConnection.findUnique({
    where: { userId_provider: { userId, provider: "lastfm" } },
    select: { username: true },
  });
  if (!connection) return null;
  const params = new URLSearchParams({ method: "user.getrecenttracks", user: connection.username, api_key: apiKey, format: "json", limit: "1" });
  let value: NowPlaying | null = null;
  try {
    const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`, {
      headers: { "User-Agent": process.env.LASTFM_USER_AGENT || "Arcadium/0.1" },
      signal: AbortSignal.timeout(3_000),
      cache: "no-store",
    });
    if (response.ok) value = readNowPlaying(await response.json());
  } catch {
    value = null;
  }
  cache.set(userId, { at: now, value });
  return value;
}
