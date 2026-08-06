export interface SpotifySearchResult {
  uri: string | null;
  webUrl: string;
  matchedTitle?: string;
  matchedArtist?: string;
}

export interface SpotifyPlaylistResult {
  id: string;
  webUrl: string;
  name: string;
}

export class SpotifyAdapter {
  /**
   * Search Spotify catalog for a track matching trackName and artistName.
   * If accessToken is not provided, returns a direct web search URL fallback.
   */
  async searchTrackUri(
    trackName: string,
    artistName: string,
    accessToken?: string
  ): Promise<SpotifySearchResult> {
    const queryStr = `${artistName} ${trackName}`;
    const webSearchUrl = `https://open.spotify.com/search/${encodeURIComponent(queryStr)}`;

    if (!accessToken) {
      return {
        uri: null,
        webUrl: webSearchUrl,
      };
    }

    try {
      const q = `track:${encodeURIComponent(trackName)} artist:${encodeURIComponent(artistName)}`;
      const response = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return { uri: null, webUrl: webSearchUrl };
      }

      const data = await response.json();
      const track = data.tracks?.items?.[0];

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
      console.error(`[SpotifyAdapter] Track search failed for "${artistName} - ${trackName}":`, error);
      return { uri: null, webUrl: webSearchUrl };
    }
  }

  /**
   * Create a new private playlist on user's Spotify account.
   */
  async createPlaylist(
    accessToken: string,
    spotifyUserId: string,
    title: string,
    description: string
  ): Promise<SpotifyPlaylistResult | null> {
    try {
      const response = await fetch(`https://api.spotify.com/v1/users/${encodeURIComponent(spotifyUserId)}/playlists`, {
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
      });

      if (!response.ok) {
        console.error(`[SpotifyAdapter] Failed to create playlist. Status: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return {
        id: data.id,
        webUrl: data.external_urls?.spotify || `https://open.spotify.com/playlist/${data.id}`,
        name: data.name,
      };
    } catch (error) {
      console.error("[SpotifyAdapter] Create playlist error:", error);
      return null;
    }
  }

  /**
   * Add array of track URIs to specified Spotify playlist in chunks of 100.
   */
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
        const response = await fetch(`https://api.spotify.com/v1/playlists/${encodeURIComponent(playlistId)}/tracks`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uris: chunk }),
        });

        if (response.ok) {
          addedCount += chunk.length;
        } else {
          console.error(`[SpotifyAdapter] Failed chunk add to playlist ${playlistId}. Status: ${response.status}`);
        }
      } catch (error) {
        console.error(`[SpotifyAdapter] Error adding tracks chunk to playlist:`, error);
      }
    }

    return { addedCount };
  }
}
