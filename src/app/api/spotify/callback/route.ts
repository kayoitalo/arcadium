import { authorizeApi } from "@/lib/security/api-auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { completeConnection } from "@/modules/spotify/application/spotify-connection";
import { spotifyStateCookie } from "@/lib/security/spotify-state";

/** Para onde o usuário volta, com o resultado legível na barra de endereço. */
function back(request: Request, params: Record<string, string>) {
  const url = new URL("/settings", new URL(request.url).origin);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = NextResponse.redirect(url);
  const state = new URL(request.url).searchParams.get("state");
  const cookieName = state && spotifyStateCookie(state);
  if (cookieName) response.cookies.delete(cookieName);
  return response;
}

export async function GET(request: Request) {
  const access = await authorizeApi(request);
  if (access.response) return access.response;
  const userId = access.userId;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const denied = url.searchParams.get("error");

  if (denied) return back(request, { spotify: "cancelado" });
  if (!code || !state) return back(request, { spotify: "erro" });

  // o state precisa bater com o cookie criado no início do fluxo
  const cookieName = spotifyStateCookie(state);
  const expected = cookieName ? (await cookies()).get(cookieName)?.value : undefined;

  if (!expected || expected !== `${userId}:${state}`) {
    return back(request, { spotify: "estado-invalido" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return back(request, { spotify: "erro" });

    const displayName = await completeConnection(user.id, code);
    return back(request, { spotify: "conectado", conta: displayName });
  } catch (error) {
    console.error("[Spotify] Callback falhou:", error);
    return back(request, { spotify: "erro" });
  }
}
