export interface SimilarArtist {
  name: string;
  /** 0..1 — o quanto o provedor considera este artista próximo da semente. */
  match: number;
}

export interface ExternalTrack {
  artistName: string;
  trackName: string;
}

/**
 * Fonte de candidatos que vive FORA do banco do usuário.
 *
 * Sem ela o motor só consegue sugerir o que a pessoa já ouviu: as linhas
 * de Track nascem dos scrobbles, então "faixa nova" simplesmente não
 * existe no catálogo local.
 *
 * Toda implementação degrada em silêncio — devolve lista vazia em vez de
 * lançar. Uma sugestão a menos é aceitável; uma página quebrada não.
 */
export interface ArtistReach {
  /** Ouvintes únicos no provedor. Serve de proxy de fama, não de qualidade. */
  listeners: number;
}

export interface SimilarArtistProvider {
  isConfigured(): boolean;
  getSimilarArtists(artistName: string, limit: number): Promise<SimilarArtist[]>;
  getTopTracks(artistName: string, limit: number): Promise<ExternalTrack[]>;
  getArtistReach(artistName: string): Promise<ArtistReach | null>;
}
