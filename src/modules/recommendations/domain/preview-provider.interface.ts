/**
 * Fonte de prévia de áudio para uma faixa.
 *
 * O Spotify removeu os `preview_url` para apps novos no fim de 2024, então
 * a prévia precisa vir de fora dele. Isso é uma consulta de catálogo
 * público — nada do que volta daqui entra nas estatísticas nem nos textos.
 */
export interface TrackPreview {
  /** MP3 de ~30s servido pelo provedor. */
  url: string;
  /** Capa que veio junto, quando o provedor tem uma melhor que a nossa. */
  artworkUrl?: string;
}

export interface PreviewProvider {
  findPreview(artistName: string, trackName: string): Promise<TrackPreview | null>;
}
