import { SpotifyAdapter } from "../infrastructure/spotify-adapter";

export interface TrackExportItem {
  trackName: string;
  artistName: string;
}

export interface ExportResponse {
  mode: "SPOTIFY_API" | "FALLBACK_PLAYLIST";
  playlistTitle: string;
  playlistUrl: string;
  totalItems: number;
  resolvedCount: number;
  unresolvedCount: number;
  items: Array<{
    artistName: string;
    trackName: string;
    uri: string | null;
    webUrl: string;
  }>;
  m3uPayload?: string;
  csvPayload?: string;
}

export class SpotifyService {
  constructor(private adapter = new SpotifyAdapter()) {}

  async exportTracks(
    tracks: TrackExportItem[],
    accessToken?: string,
    spotifyUserId?: string,
    customTitle?: string
  ): Promise<ExportResponse> {
    const monthYear = new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const playlistTitle = customTitle || `Grooveyard — Descobertas (${monthYear})`;
    const description = "Seleção de descobertas gerada pelo Grooveyard.";

    if (tracks.length === 0) {
      return {
        mode: "FALLBACK_PLAYLIST",
        playlistTitle,
        playlistUrl: "https://open.spotify.com",
        totalItems: 0,
        resolvedCount: 0,
        unresolvedCount: 0,
        items: [],
      };
    }

    const resolvedItems = await Promise.all(
      tracks.map(async (t) => {
        const result = await this.adapter.searchTrackUri(t.trackName, t.artistName, accessToken);
        return {
          artistName: t.artistName,
          trackName: t.trackName,
          uri: result.uri,
          webUrl: result.webUrl,
        };
      })
    );

    const validUris = resolvedItems.map((item) => item.uri).filter((u): u is string => u !== null);
    const resolvedCount = validUris.length;
    const unresolvedCount = tracks.length - resolvedCount;

    if (accessToken && spotifyUserId && validUris.length > 0) {
      const playlist = await this.adapter.createPlaylist(accessToken, spotifyUserId, playlistTitle, description);
      if (playlist) {
        await this.adapter.addTracksToPlaylist(accessToken, playlist.id, validUris);
        return {
          mode: "SPOTIFY_API",
          playlistTitle,
          playlistUrl: playlist.webUrl,
          totalItems: tracks.length,
          resolvedCount,
          unresolvedCount,
          items: resolvedItems,
        };
      }
    }

    let m3uLines = ["#EXTM3U", `#PLAYLIST:${playlistTitle}`];
    let csvLines = ["Artist,Track,Spotify Search Link"];

    resolvedItems.forEach((item) => {
      m3uLines.push(`#EXTINF:-1,${item.artistName} - ${item.trackName}`);
      m3uLines.push(item.webUrl);
      csvLines.push(`"${item.artistName}","${item.trackName}","${item.webUrl}"`);
    });

    const firstSearchUrl = resolvedItems[0]?.webUrl || "https://open.spotify.com";

    return {
      mode: "FALLBACK_PLAYLIST",
      playlistTitle,
      playlistUrl: firstSearchUrl,
      totalItems: tracks.length,
      resolvedCount,
      unresolvedCount,
      items: resolvedItems,
      m3uPayload: m3uLines.join("\n"),
      csvPayload: csvLines.join("\n"),
    };
  }
}
