import { describe, expect, it } from "vitest";
import { chromaFromPixels, coverProxyUrl, normalizeChroma, rgbToHsl } from "./chroma";

function fill(rgb: [number, number, number], pixels = 64): Uint8ClampedArray {
  const data = new Uint8ClampedArray(pixels * 4);
  for (let i = 0; i < pixels; i += 1) {
    data[i * 4] = rgb[0];
    data[i * 4 + 1] = rgb[1];
    data[i * 4 + 2] = rgb[2];
    data[i * 4 + 3] = 255;
  }
  return data;
}

describe("rgbToHsl", () => {
  it("resolve os primários", () => {
    expect(rgbToHsl(255, 0, 0)[0]).toBeCloseTo(0);
    expect(rgbToHsl(0, 255, 0)[0]).toBeCloseTo(120);
    expect(rgbToHsl(0, 0, 255)[0]).toBeCloseTo(240);
  });

  it("trata cinza como sem saturação", () => {
    const [, saturation] = rgbToHsl(128, 128, 128);
    expect(saturation).toBe(0);
  });
});

describe("normalizeChroma", () => {
  it("levanta uma cor lavada até virar acento visível", () => {
    expect(normalizeChroma({ h: 200, s: 8, l: 20 })).toEqual({ h: 200, s: 44, l: 50 });
  });

  it("segura uma cor neon dentro da faixa legível", () => {
    expect(normalizeChroma({ h: 320, s: 100, l: 95 })).toEqual({ h: 320, s: 80, l: 66 });
  });
});

describe("chromaFromPixels", () => {
  it("encontra a matiz dominante de uma capa colorida", () => {
    const chroma = chromaFromPixels(fill([40, 110, 220]));
    expect(chroma).not.toBeNull();
    expect(chroma!.h).toBeGreaterThan(200);
    expect(chroma!.h).toBeLessThan(240);
  });

  it("devolve null para capa em preto e branco em vez de inventar cor", () => {
    expect(chromaFromPixels(fill([18, 18, 18]))).toBeNull();
    expect(chromaFromPixels(fill([200, 200, 200]))).toBeNull();
  });

  it("ignora o fundo e fica com a cor que domina a arte", () => {
    const data = new Uint8ClampedArray(100 * 4);
    for (let i = 0; i < 100; i += 1) {
      // 70% quase-preto (descartado), 30% vermelho
      const red = i >= 70;
      data[i * 4] = red ? 210 : 6;
      data[i * 4 + 1] = red ? 40 : 6;
      data[i * 4 + 2] = red ? 40 : 6;
      data[i * 4 + 3] = 255;
    }
    const chroma = chromaFromPixels(data);
    expect(chroma).not.toBeNull();
    expect(chroma!.h).toBeLessThan(20);
  });

  it("descarta pixels transparentes", () => {
    const data = fill([40, 110, 220]);
    for (let i = 0; i < 64; i += 1) data[i * 4 + 3] = 0;
    expect(chromaFromPixels(data)).toBeNull();
  });
});

describe("coverProxyUrl", () => {
  it("passa a capa pela mesma origem para o canvas poder ler os pixels", () => {
    expect(coverProxyUrl("https://example.org/a b.jpg")).toBe("/api/cover?u=https%3A%2F%2Fexample.org%2Fa%20b.jpg");
  });

  it("devolve null quando não há capa", () => {
    expect(coverProxyUrl(null)).toBeNull();
    expect(coverProxyUrl(undefined)).toBeNull();
    expect(coverProxyUrl("")).toBeNull();
  });
});
