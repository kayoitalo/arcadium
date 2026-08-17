export interface CoverArtResult {
  url: string;
  source: "cover-art-archive" | "lastfm";
  entityType: "release" | "release-group";
  mbid: string;
}

export interface AlbumCoverFallbackProvider {
  findAlbumCover(artistName: string, albumName: string): Promise<CoverArtResult | null>;
}

export interface CoverArtProvider {
  findFrontCover(releaseMbid: string): Promise<CoverArtResult | null>;
  findReleaseGroupFrontCover(releaseGroupMbid: string): Promise<CoverArtResult | null>;
}
