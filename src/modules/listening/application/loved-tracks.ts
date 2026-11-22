import { prisma } from "@/lib/db/prisma";

export interface LovedTrack { artistName: string; trackName: string }

type RawLoved = { name?: string; artist?: { name?: string; "#text"?: string } };

/** Lê user.getlovedtracks: as faixas com ♥, da mais recente pra trás. */
export function readLovedTracks(payload: unknown): LovedTrack[] {
  const raw = (payload as { lovedtracks?: { track?: RawLoved | RawLoved[] } })?.lovedtracks?.track;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.flatMap((track) => {
    const artistName = track.artist?.name || track.artist?.["#text"];
    return track.name && artistName ? [{ artistName, trackName: track.name }] : [];
  });
}

const cache = new Map<string, { at: number; value: LovedTrack[] }>();
/** O ♥ muda pouco: uma consulta a cada seis horas por conta basta. */
const TTL_MS = 6 * 60 * 60 * 1000;

/** As faixas amadas no Last.fm, da mais recente pra trás. Sem conta, sem chave ou com falha: lista vazia. */
export async function loadLovedTracks(userId: string, now = new Date()): Promise<LovedTrack[]> {
  // o rodízio do dia é do Descobrir (declaredSeeds): aqui vem a lista crua
  const hit = cache.get(userId);
  if (hit && now.getTime() - hit.at < TTL_MS) return hit.value;
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];
  const connection = await prisma.providerConnection.findUnique({
    where: { userId_provider: { userId, provider: "lastfm" } },
    select: { username: true },
  });
  if (!connection) return [];
  const params = new URLSearchParams({ method: "user.getlovedtracks", user: connection.username, api_key: apiKey, format: "json", limit: "50" });
  let value: LovedTrack[] = [];
  try {
    const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`, {
      headers: { "User-Agent": process.env.LASTFM_USER_AGENT || "Arcadium/0.1" },
      signal: AbortSignal.timeout(4_000),
      cache: "no-store",
    });
    if (response.ok) value = readLovedTracks(await response.json());
  } catch {
    // falhou: o Descobrir segue sem o ♥, e a próxima geração tenta de novo
    return [];
  }
  cache.set(userId, { at: now.getTime(), value });
  return value;
}
