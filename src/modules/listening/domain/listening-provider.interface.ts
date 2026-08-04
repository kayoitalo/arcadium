export interface ListenItem {
  rawArtistName: string;
  rawTrackName: string;
  rawAlbumName?: string;
  playedAtUtcSeconds: number;
  mbid?: string;
}

export interface ListenPage {
  items: ListenItem[];
  page: number;
  totalPages: number;
  totalItems: number;
}

export interface FetchListensInput {
  username: string;
  page?: number;
  limit?: number;
  from?: number; // Unix timestamp UTC
  to?: number;   // Unix timestamp UTC
}

export interface ListeningHistoryProvider {
  fetchListens(input: FetchListensInput): Promise<ListenPage>;
}
