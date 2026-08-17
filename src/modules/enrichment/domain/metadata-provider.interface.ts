export interface EnrichedArtistResult {
  mbid: string;
  name: string;
  country: string | null;
  type: string | null;
  disambiguation: string | null;
  tags: string[];
  score: number; // 0 to 1 confidence
}

export interface EnrichedAlbumResult {
  mbid: string;
  releaseGroupMbid: string | null;
  title: string;
  releaseYear: number | null;
  primaryType: string | null;
}

export interface EnrichedTrackResult {
  mbid: string;
  title: string;
  durationMs: number | null;
}

export interface MetadataProvider {
  searchArtist(artistName: string): Promise<EnrichedArtistResult | null>;
  searchAlbum(albumName: string, artistMbid?: string): Promise<EnrichedAlbumResult | null>;
}
