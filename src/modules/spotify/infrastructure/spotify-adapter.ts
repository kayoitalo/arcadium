import { PlaylistProvider, PlaylistSearchResult, PlaylistResult } from "../domain/playlist-provider.interface";
import { SpotifyAuthError } from "../domain/spotify-errors";
import { compatibleRecording } from "@/lib/music/recording-match";

/** Nenhuma chamada pode ficar pendurada segurando a exportação. */
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * 401 significa autorização recusada — token revogado no painel da conta,
 * permissão retirada ou senha trocada. Precisa subir como erro, senão a
 * exportação cai calada no .m3u e a pessoa acha que a playlist foi criada.
 */
function assertAuthorized(status: number, operation: string): void {
  if (status === 401) throw new SpotifyAuthError(operation);
}

export class SpotifyAdapter implements PlaylistProvider {

  async searchTrackUri(
    trackName: string,
    artistName: string,
    accessToken?: string
  ): Promise<PlaylistSearchResult> {
    const queryStr = `${artistName} ${trackName}`;
    const webSearchUrl = `https://open.spotify.com/search/${encodeURIComponent(queryStr)}`;

    if (!accessToken) {
      return {
        uri: null,
        webUrl: webSearchUrl,
      };
    }

    // URLSearchParams codifica o espaço entre os filtros; interpolar na mão
    // deixava um espaço cru na URL.
    //
    // Sem parâmetro `market`: o valor legado "from_token" foi removido da API
    // e derruba a busca inteira. O mercado correto viria do país da conta, e
    // isso pede guardar o country do perfil na conexão.
    const query = new URLSearchParams({
      q: `track:${trackName} artist:${artistName}`,
      type: "track",
      limit: "10",
    });

    try {
      const response = await fetch(`https://api.spotify.com/v1/search?${query}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      assertAuthorized(response.status, "busca de faixa");

      if (!response.ok) {
        // sem este aviso, uma busca recusada vira "faixa não encontrada" e a
        // exportação cai no plano B sem deixar rastro de por quê
        console.warn(
          `[SpotifyAdapter] busca devolveu HTTP ${response.status} para "${artistName} - ${trackName}"`
        );
        return { uri: null, webUrl: webSearchUrl };
      }

      const data = await response.json();
      const track = data.tracks?.items?.find((candidate: {
        name?: string; artists?: Array<{ name?: string }>; uri?: string;
      }) => typeof candidate.name === "string" && candidate.uri?.startsWith("spotify:track:")
        && compatibleRecording({ artistName, trackName }, {
          artistName: candidate.artists?.[0]?.name ?? "", trackName: candidate.name,
        }));

      if (!track) {
        return { uri: null, webUrl: webSearchUrl };
      }

      return {
        uri: track.uri,
        webUrl: track.external_urls?.spotify || webSearchUrl,
        matchedTitle: track.name,
        matchedArtist: track.artists?.[0]?.name,
      };
    } catch (error) {
      if (error instanceof SpotifyAuthError) throw error;
      console.error(`[SpotifyAdapter] Track search failed for "${artistName} - ${trackName}":`, error);
      return { uri: null, webUrl: webSearchUrl };
    }
  }

  async createPlaylist(
    accessToken: string,
    _spotifyUserId: string,
    title: string,
    description: string
  ): Promise<PlaylistResult | null> {
    try {
      const response = await fetch("https://api.spotify.com/v1/me/playlists", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: title,
          description: description,
          public: false,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      assertAuthorized(response.status, "criação da playlist");

      if (!response.ok) {
        // o status sozinho não diz nada: o Spotify explica o 403 no corpo
        const detail = await response.text().catch(() => "");
        console.error(
          `[SpotifyAdapter] Falha ao criar playlist. HTTP ${response.status}: ${detail.slice(0, 300)}`
        );
        return null;
      }

      const data = await response.json();
      return {
        id: data.id,
        webUrl: data.external_urls?.spotify || `https://open.spotify.com/playlist/${data.id}`,
        name: data.name,
      };
    } catch (error) {
      if (error instanceof SpotifyAuthError) throw error;
      console.error("[SpotifyAdapter] Create playlist error:", error);
      return null;
    }
  }

  async addTracksToPlaylist(
    accessToken: string,
    playlistId: string,
    trackUris: string[]
  ): Promise<{ addedCount: number }> {
    const validUris = trackUris.filter((uri) => uri && uri.startsWith("spotify:track:"));
    if (validUris.length === 0) return { addedCount: 0 };

    let addedCount = 0;
    const chunkSize = 100;

    for (let i = 0; i < validUris.length; i += chunkSize) {
      const chunk = validUris.slice(i, i + chunkSize);
      try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/items`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris: chunk }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        assertAuthorized(response.status, "adição de faixas");

        if (response.ok) {
          addedCount += chunk.length;
        } else {
          console.error(`[SpotifyAdapter] Failed chunk add to playlist ${playlistId}. Status: ${response.status}`);
        }
      } catch (error) {
        if (error instanceof SpotifyAuthError) throw error;
        console.error(`[SpotifyAdapter] Error adding tracks chunk to playlist:`, error);
      }
    }

    return { addedCount };
  }
}
