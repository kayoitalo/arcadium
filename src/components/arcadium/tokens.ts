/**
 * Tokens do gabinete.
 *
 * Um fliperama não é monocromático: âmbar é o chassi e o dado — continua
 * sendo a cor da máquina em toda tela — mas os controles têm cor própria.
 * Ciano e magenta entram só em controle e estado, nunca em número.
 */

export const AMBER = "#ffb000";
export const CYAN = "#2ee6e6";
export const MAGENTA = "#ff3d8b";
export const GREEN = "#5faa8b";

/** Vidro de tubo: a linha escura que atravessa qualquer tela acesa. */
export const SCANLINES = "repeating-linear-gradient(0deg, rgb(0 0 0 / 0.42) 0 1px, transparent 1px 3px)";

export const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

/** Quantas barras o espectro desenha. */
export const BANDS = 24;

/**
 * A FFT é linear em frequência e o ouvido não é. Com fftSize 1024 cada
 * banda vale ~43Hz; o intervalo útil da prévia vai até uns 10kHz, então as
 * barras se espalham exponencialmente sobre as bandas 2..250 — poucas
 * bandas graves à esquerda, muitas agudas à direita.
 */
export const FFT_SIZE = 1024;

export const BAND_EDGES = Array.from({ length: BANDS + 1 }, (_, index) =>
  Math.floor(2 + Math.pow(index / BANDS, 1.9) * 248),
);

/**
 * Música cai de energia conforme sobe a frequência. Sem compensar isso as
 * barras graves ficam cravadas no topo e as agudas no chão. Cada barra tem
 * o seu próprio piso.
 */
export const BAND_FLOORS = Array.from({ length: BANDS }, (_, index) => 165 - (index / (BANDS - 1)) * 125);

/** Bandas contadas no nível geral: acima disto é agudo que quase não soa. */
export const LEVEL_BINS = 160;
