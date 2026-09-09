import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LastFmSimilarArtistProvider } from "../lastfm-similar-adapter";

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("LastFmSimilarArtistProvider", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = ORIGINAL_FETCH;
  });

  it("fica inerte sem chave, sem tocar na rede", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const provider = new LastFmSimilarArtistProvider("");

    expect(provider.isConfigured()).toBe(false);
    expect(await provider.getSimilarArtists("Ramones", 5)).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("normaliza o match para 0..1 e descarta nomes vazios", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        similarartists: {
          artist: [
            { name: "The Clash", match: "0.978" },
            { name: "  ", match: "0.5" },
            { name: "Buzzcocks", match: "2" },
            { name: "Misfits" },
          ],
        },
      }),
    ) as unknown as typeof fetch;

    const provider = new LastFmSimilarArtistProvider("chave-de-teste");
    const similar = await provider.getSimilarArtists("Ramones", 10);

    expect(similar).toEqual([
      { name: "The Clash", match: 0.978 },
      { name: "Buzzcocks", match: 1 },
      { name: "Misfits", match: 0 },
    ]);
  });

  it("guarda em cache: a segunda chamada não vai à rede", async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({ similarartists: { artist: [{ name: "Sonic Youth", match: "0.8" }] } }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const provider = new LastFmSimilarArtistProvider("chave-de-teste");
    await provider.getSimilarArtists("Dinosaur Jr Cache", 5);
    await provider.getSimilarArtists("Dinosaur Jr Cache", 5);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("devolve lista vazia quando o provedor erra, em vez de lançar", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ error: 6 }, 500)) as unknown as typeof fetch;
    const provider = new LastFmSimilarArtistProvider("chave-de-teste");

    await expect(provider.getSimilarArtists("Artista Fora Do Ar", 5)).resolves.toEqual([]);
  });

  it("devolve lista vazia quando a resposta tem formato inesperado", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ inesperado: true })) as unknown as typeof fetch;
    const provider = new LastFmSimilarArtistProvider("chave-de-teste");

    await expect(provider.getSimilarArtists("Artista Estranho", 5)).resolves.toEqual([]);
  });

  it("devolve lista vazia quando a rede falha", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const provider = new LastFmSimilarArtistProvider("chave-de-teste");

    await expect(provider.getTopTracks("Artista Sem Rede", 2)).resolves.toEqual([]);
  });

  it("extrai as faixas principais com o nome corrigido pelo provedor", async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({
        toptracks: {
          track: [
            { name: "London Calling", artist: { name: "The Clash" } },
            { name: "  ", artist: { name: "The Clash" } },
          ],
        },
      }),
    ) as unknown as typeof fetch;

    const provider = new LastFmSimilarArtistProvider("chave-de-teste");
    const tracks = await provider.getTopTracks("the clash", 2);

    expect(tracks).toEqual([{ artistName: "The Clash", trackName: "London Calling" }]);
  });
});
