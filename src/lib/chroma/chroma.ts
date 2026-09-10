export interface Chroma {
  h: number;
  s: number;
  l: number;
}

/**
 * Tinta neutra, usada quando a capa é monocromática, falha ou não existe.
 * É um latão quente: sobre a goma-laca do fundo, um acento frio soaria
 * como se a página tivesse sido impressa em outra gráfica.
 */
export const NEUTRAL_CHROMA: Chroma = { h: 30, s: 46, l: 60 };

/** Faixa em que um acento continua legível sobre o fundo grafite. */
const MIN_SATURATION = 44;
const MAX_SATURATION = 80;
const MIN_LIGHTNESS = 50;
const MAX_LIGHTNESS = 66;

export function coverProxyUrl(source?: string | null): string | null {
  if (!source) return null;
  return `/api/cover?u=${encodeURIComponent(source)}`;
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) return [0, 0, lightness * 100];

  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue: number;
  if (max === red) hue = (green - blue) / delta + (green < blue ? 6 : 0);
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;

  return [hue * 60, saturation * 100, lightness * 100];
}

/**
 * Normaliza a cor bruta da capa para a faixa em que ela funciona como
 * acento de interface. Uma capa lavada não vira um acento invisível e
 * uma capa neon não vira um acento que queima o olho.
 */
export function normalizeChroma(chroma: Chroma): Chroma {
  return {
    h: Math.round(chroma.h),
    s: Math.round(Math.min(MAX_SATURATION, Math.max(MIN_SATURATION, chroma.s))),
    l: Math.round(Math.min(MAX_LIGHTNESS, Math.max(MIN_LIGHTNESS, chroma.l))),
  };
}

/**
 * Histograma de matiz sobre os pixels da capa, ignorando cinzas e
 * extremos de luminosidade — eles descrevem o fundo, não a identidade
 * da arte. Devolve null quando não sobra matiz suficiente (capas em
 * preto e branco), e nesse caso o chamador usa NEUTRAL_CHROMA.
 */
export function chromaFromPixels(pixels: Uint8ClampedArray): Chroma | null {
  const buckets = new Map<number, { count: number; h: number; s: number; l: number }>();

  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const [h, s, l] = rgbToHsl(pixels[i], pixels[i + 1], pixels[i + 2]);
    if (s < 18 || l < 12 || l > 88) continue;
    const key = Math.round(h / 12) * 12;
    const bucket = buckets.get(key) ?? { count: 0, h: 0, s: 0, l: 0 };
    bucket.count += 1;
    bucket.h += h;
    bucket.s += s;
    bucket.l += l;
    buckets.set(key, bucket);
  }

  let winner: { count: number; h: number; s: number; l: number } | null = null;
  for (const bucket of buckets.values()) {
    if (!winner || bucket.count > winner.count) winner = bucket;
  }
  if (!winner || winner.count < 12) return null;

  return normalizeChroma({
    h: winner.h / winner.count,
    s: winner.s / winner.count,
    l: winner.l / winner.count,
  });
}
