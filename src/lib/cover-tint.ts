/*
 * A cor que uma capa empresta ao papel. "Uma cor e neutros; as capas
 * trazem o resto": a luz em volta da capa e a lombada do disco saem da
 * própria arte, medida no navegador. A capa chega pelo proxy do app, na
 * mesma origem, então o canvas pode ler os pixels.
 *
 * A conta é pura e pequena de propósito: média ponderada pela saturação
 * (o que a capa tem de cor pesa mais que o fundo preto ou branco) e,
 * depois, a cor é trazida para uma faixa que aparece no papel escuro sem
 * gritar — luz de capa, não tinta nova.
 */

/** Três canais em 0–255, prontos para `rgb(var(--x) / alfa)`. */
export type Tint = `${number} ${number} ${number}`;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function toHsl(r: number, g: number, b: number): [number, number, number] {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h / 6, s, l];
}

function toRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)].map((v) => Math.round(v * 255)) as [number, number, number];
}

/**
 * A cor de uma capa a partir dos pixels dela (RGBA em sequência).
 * Devolve `null` quando não há pixel opaco para medir.
 */
export function tintFromPixels(data: ArrayLike<number>): Tint | null {
  let [r, g, b, total] = [0, 0, 0, 0];
  for (let index = 0; index + 3 < data.length; index += 4) {
    if (data[index + 3] < 128) continue;
    const [pr, pg, pb] = [data[index], data[index + 1], data[index + 2]];
    const chroma = (Math.max(pr, pg, pb) - Math.min(pr, pg, pb)) / 255;
    // um pouco de peso para todo mundo: capa cinza continua tendo cor (cinza)
    const weight = 0.04 + chroma * chroma;
    r += pr * weight;
    g += pg * weight;
    b += pb * weight;
    total += weight;
  }
  if (total === 0) return null;
  const [h, s, l] = toHsl(r / total, g / total, b / total);
  // faixa que aparece no papel escuro: nem apagada, nem neon
  const [nr, ng, nb] = toRgb(h, clamp(s, 0, 0.72), clamp(l, 0.5, 0.66));
  return `${nr} ${ng} ${nb}`;
}

/** Tinta legível sobre a cor da capa: escura nas claras, clara nas escuras. */
export function inkOn(tint: Tint): "dark" | "light" {
  const [r, g, b] = tint.split(" ").map(Number);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? "dark" : "light";
}

/** Lê a cor de uma imagem já carregada. Capa de outra origem (canvas "tainted") fica sem cor. */
export function readTint(image: HTMLImageElement): Tint | null {
  try {
    const side = 24;
    const canvas = document.createElement("canvas");
    canvas.width = side;
    canvas.height = side;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0, side, side);
    return tintFromPixels(context.getImageData(0, 0, side, side).data);
  } catch {
    return null;
  }
}
