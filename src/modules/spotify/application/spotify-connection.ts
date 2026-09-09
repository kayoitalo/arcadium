import { prisma } from "@/lib/db/prisma";
import { decryptJson, encryptJson, hasEncryptionKey } from "@/lib/security/token-crypto";

const PROVIDER = "spotify";
const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

export const SPOTIFY_SCOPES = ["playlist-modify-private", "playlist-modify-public"];

const REFRESH_MARGIN_MS = 60_000;

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  spotifyUserId: string;
  displayName: string;
}

export interface SpotifyConnectionStatus {
  configured: boolean;
  connected: boolean;
  displayName?: string;
  reason?: string;
}

function credentials() {
  return {
    clientId: process.env.SPOTIFY_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET?.trim() ?? "",
    redirectUri:
      process.env.SPOTIFY_REDIRECT_URI?.trim() ?? "http://127.0.0.1:3000/api/spotify/callback",
  };
}

export function isSpotifyConfigured(): boolean {
  const { clientId, clientSecret } = credentials();
  return Boolean(clientId && clientSecret) && hasEncryptionKey();
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId, redirectUri } = credentials();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    state,
    scope: SPOTIFY_SCOPES.join(" "),
    show_dialog: "true",
  });
  return `${AUTHORIZE_URL}?${params}`;
}

async function requestTokens(body: URLSearchParams): Promise<Record<string, any>> {
  const { clientId, clientSecret } = credentials();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error_description ?? payload.error ?? "Troca de token recusada.");
  }
  return payload;
}

async function fetchProfile(accessToken: string): Promise<{ id: string; display_name?: string }> {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Não foi possível ler o perfil do Spotify.");
  return response.json();
}

export async function completeConnection(userId: string, code: string): Promise<string> {
  const { redirectUri } = credentials();
  const tokens = await requestTokens(
    new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  );

  const profile = await fetchProfile(tokens.access_token);
  const stored: StoredTokens = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    spotifyUserId: profile.id,
    displayName: profile.display_name || profile.id,
  };

  await prisma.providerConnection.upsert({
    where: { userId_provider: { userId, provider: PROVIDER } },
    create: {
      userId,
      provider: PROVIDER,
      username: stored.displayName,
      status: "ACTIVE",
      encryptedTokens: encryptJson(stored),
    },
    update: {
      username: stored.displayName,
      status: "ACTIVE",
      encryptedTokens: encryptJson(stored),
    },
  });

  return stored.displayName;
}

async function readTokens(userId: string): Promise<StoredTokens | null> {
  const connection = await prisma.providerConnection.findUnique({
    where: { userId_provider: { userId, provider: PROVIDER } },
  });
  if (!connection?.encryptedTokens || connection.status !== "ACTIVE") return null;

  try {
    return decryptJson<StoredTokens>(connection.encryptedTokens);
  } catch {
    return null;
  }
}

export async function getValidAccessToken(
  userId: string,
): Promise<{ accessToken: string; spotifyUserId: string } | null> {
  const stored = await readTokens(userId);
  if (!stored) return null;

  if (stored.expiresAt - REFRESH_MARGIN_MS > Date.now()) {
    return { accessToken: stored.accessToken, spotifyUserId: stored.spotifyUserId };
  }

  try {
    const refreshed = await requestTokens(
      new URLSearchParams({ grant_type: "refresh_token", refresh_token: stored.refreshToken }),
    );

    const next: StoredTokens = {
      ...stored,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? stored.refreshToken,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
    };

    await prisma.providerConnection.update({
      where: { userId_provider: { userId, provider: PROVIDER } },
      data: { encryptedTokens: encryptJson(next) },
    });

    return { accessToken: next.accessToken, spotifyUserId: next.spotifyUserId };
  } catch (error) {
    console.error("[Spotify] Falha ao renovar o token:", error);
    await prisma.providerConnection.update({
      where: { userId_provider: { userId, provider: PROVIDER } },
      data: { status: "NEEDS_REAUTH" },
    }).catch(() => null);
    return null;
  }
}

export async function getConnectionStatus(userId: string): Promise<SpotifyConnectionStatus> {
  if (!isSpotifyConfigured()) {
    const { clientId, clientSecret } = credentials();
    return {
      configured: false,
      connected: false,
      reason: !clientId || !clientSecret
        ? "Faltam SPOTIFY_CLIENT_ID e SPOTIFY_CLIENT_SECRET."
        : "Falta TOKEN_ENCRYPTION_KEY para guardar o token com segurança.",
    };
  }

  const connection = await prisma.providerConnection.findUnique({
    where: { userId_provider: { userId, provider: PROVIDER } },
  });

  return {
    configured: true,
    connected: connection?.status === "ACTIVE" && Boolean(connection.encryptedTokens),
    displayName: connection?.username,
    reason: connection?.status === "NEEDS_REAUTH" ? "A autorização expirou; conecte de novo." : undefined,
  };
}

/** A autorização caiu: a conexão fica, mas pedindo para reconectar. */
export async function markNeedsReauth(userId: string): Promise<void> {
  await prisma.providerConnection
    .updateMany({ where: { userId, provider: PROVIDER }, data: { status: "NEEDS_REAUTH" } })
    .catch(() => null);
}

export async function disconnect(userId: string): Promise<void> {
  await prisma.providerConnection.deleteMany({ where: { userId, provider: PROVIDER } });
}
