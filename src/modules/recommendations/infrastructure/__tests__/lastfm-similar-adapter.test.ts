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
    const provider = new LastFmSimilarArtistProvider("", undefined, { minIntervalMs: 0 });

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

    const provider = new LastFmSimilarArtistProvider("chave-de-teste", undefined, { minIntervalMs: 0 });
    const similar = await provider.getSimilarArtists("Ramones", 10);

    expect(similar.map(({ name, match }) => ({ name, match }))).toEqual([
      { name: "The Clash", match: 0.978 },
      { name: "Buzzcocks", match: 1 },
      { name: "Misfits", match: 0 },
    ]);
    expect(similar[1].rawMatch).toBe(2);
  });

  it("guarda em cache: a segunda chamada não vai à rede", async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({ similarartists: { artist: [{ name: "Sonic Youth", match: "0.8" }] } }),
    );
    globalThis.fetch = fetchSpy as unknown as typeof fetch;

    const provider = new LastFmSimilarArtistProvider("chave-de-teste", undefined, { minIntervalMs: 0 });
    await provider.getSimilarArtists("Dinosaur Jr Cache", 5);
    await provider.getSimilarArtists("Dinosaur Jr Cache", 5);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("devolve lista vazia quando o provedor erra, em vez de lançar", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ error: 6 }, 500)) as unknown as typeof fetch;
    const provider = new LastFmSimilarArtistProvider("chave-de-teste", undefined, { minIntervalMs: 0 });

    await expect(provider.getSimilarArtists("Artista Fora Do Ar", 5)).resolves.toEqual([]);
  });

  it("devolve lista vazia quando a resposta tem formato inesperado", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ inesperado: true })) as unknown as typeof fetch;
    const provider = new LastFmSimilarArtistProvider("chave-de-teste", undefined, { minIntervalMs: 0 });

    await expect(provider.getSimilarArtists("Artista Estranho", 5)).resolves.toEqual([]);
  });

  it("devolve lista vazia quando a rede falha", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    const provider = new LastFmSimilarArtistProvider("chave-de-teste", undefined, { minIntervalMs: 0 });

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

    const provider = new LastFmSimilarArtistProvider("chave-de-teste", undefined, { minIntervalMs: 0 });
    const tracks = await provider.getTopTracks("the clash", 2);

    expect(tracks).toEqual([{ artistName: "The Clash", trackName: "London Calling" }]);
  });
  it("preserves track-match values outside 0..1 and searches the requested version without autocorrection", async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({ similartracks: { track: [
      { name: "Neighbor", artist: { name: "Other" }, match: "10.95" },
      { name: "Another", artist: { name: "Else" }, match: "0.25" },
    ] } })) as unknown as typeof fetch;
    const provider = new LastFmSimilarArtistProvider("key", undefined, { minIntervalMs: 0 });
    const result = await provider.getSimilarTracks("Band", "Song (Live)", 12);
    expect(result.map((track) => [track.rank, track.rawMatch])).toEqual([[1, 10.95], [2, .25]]);
    const url = new URL(String(vi.mocked(fetch).mock.calls[0][0]));
    expect(url.searchParams.get("track")).toBe("Song (Live)");
    expect(url.searchParams.get("autocorrect")).toBe("0");
    await provider.getSimilarTracks("Band", "Song (Live)", 12);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("does not cache temporary failures as an empty track catalog", async () => {
    const call = vi.fn().mockResolvedValueOnce(jsonResponse({ error: 11 })).mockResolvedValueOnce(jsonResponse({ similartracks: { track: [
      { name: "Recovered", artist: { name: "Other" } },
    ] } }));
    globalThis.fetch = call;
    const provider = new LastFmSimilarArtistProvider("key", undefined, { minIntervalMs: 0 });
    expect(await provider.getSimilarTracks("Temporary Seed", "Version", 12)).toEqual([]);
    expect((await provider.getSimilarTracks("Temporary Seed", "Version", 12))[0].trackName).toBe("Recovered");
    expect(call).toHaveBeenCalledTimes(2);
  });
  it("stops queued discovery requests after a rate-limit response instead of retrying a burst", async () => {
    vi.resetModules();
    const { LastFmSimilarArtistProvider: Fresh } = await import("../lastfm-similar-adapter");
    globalThis.fetch = vi.fn(async () => jsonResponse({ error: 29 })) as unknown as typeof fetch;
    const provider = new Fresh("key");
    await Promise.all([provider.getSimilarArtists("Rate A", 12), provider.getSimilarArtists("Rate B", 12)]);
    expect(fetch).toHaveBeenCalledOnce();
  });
  it("does not start another request after the session's request window expires", async () => {
    const provider = new LastFmSimilarArtistProvider("key", undefined, { minIntervalMs: 0 });
    provider.beginDiscoveryWindow(0);
    globalThis.fetch = vi.fn();
    expect(await provider.getSimilarTracks("Expired Seed", "Song", 12)).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    expect(provider.getDiagnostics().deadlineStops).toBe(1);
    expect(provider.getDiagnostics().externalAttempts).toBe(0);
  });
});
