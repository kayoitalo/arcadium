/**
 * O Spotify recusou o token: revogado no painel da conta, permissão
 * retirada, ou senha trocada. É diferente de "não achei a faixa".
 *
 * Sem essa distinção a exportação cai calada no plano B — a pessoa
 * recebe um .m3u achando que a playlist foi criada, quando na verdade
 * precisa reconectar a conta.
 */
export class SpotifyAuthError extends Error {
  constructor(operation: string) {
    super(`Spotify recusou a autorização em "${operation}".`);
    this.name = "SpotifyAuthError";
  }
}

export function isSpotifyAuthError(error: unknown): error is SpotifyAuthError {
  return error instanceof SpotifyAuthError;
}
