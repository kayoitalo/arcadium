export interface PlaylistSearchResult {
  uri: string | null;
  webUrl: string;
  matchedTitle?: string;
  matchedArtist?: string;
}

export interface PlaylistResult {
  id: string;
  webUrl: string;
  name: string;
}

export interface PlaylistProvider {
  searchTrackUri(trackName: string, artistName: string, accessToken?: string): Promise<PlaylistSearchResult>;
  createPlaylist(accessToken: string, userId: string, title: string, description: string): Promise<PlaylistResult | null>;
  addTracksToPlaylist(accessToken: string, playlistId: string, trackUris: string[]): Promise<{ addedCount: number }>;
}
