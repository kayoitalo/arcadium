export interface CoverArtResult {
  url: string;
  source: "cover-art-archive" | "lastfm" | "itunes";
  entityType: "release" | "release-group";
  mbid: string;
}

export interface AlbumCoverFallbackProvider {
  findAlbumCover(artistName: string, albumName: string): Promise<CoverArtResult | null>;
}

/**
 * Sugestões vindas de fora do catálogo local não têm álbum — só artista
 * e faixa. Este contrato existe para conseguir uma capa mesmo assim.
 */
export interface TrackCoverProvider {
  findTrackCover(artistName: string, trackName: string): Promise<CoverArtResult | null>;
}

export interface CoverArtProvider {
  findFrontCover(releaseMbid: string): Promise<CoverArtResult | null>;
  findReleaseGroupFrontCover(releaseGroupMbid: string): Promise<CoverArtResult | null>;
}
