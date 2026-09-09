import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MusicBrainzAdapter } from "../musicbrainz-adapter";

describe("MusicBrainzAdapter", () => {
  let adapter: MusicBrainzAdapter;

  beforeEach(() => {
    // tempos curtos: a suíte não pode esperar o intervalo real de 1 req/s
    adapter = new MusicBrainzAdapter("GrooveyardTest/1.0", { minDelayMs: 0, backoffBaseMs: 1 });
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses artist metadata accurately when exact match is found", async () => {
    const mockArtistResponse = {
      artists: [
        {
          id: "cc197b91-446d-4979-9f62-912ed57db323",
          name: "Radiohead",
          country: "GB",
          type: "Group",
          disambiguation: "British rock band",
          score: 100,
          tags: [
            { name: "alternative rock", count: 45 },
            { name: "art rock", count: 30 },
          ],
        },
      ],
    };

    (globalThis.fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => mockArtistResponse })
      // segunda chamada: o lookup que traz os gêneros curados
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ genres: [{ name: "alternative rock", count: 45 }, { name: "art rock", count: 30 }] }),
      });

    const result = await adapter.searchArtist("Radiohead");

    expect(result).not.toBeNull();
    expect(result?.mbid).toBe("cc197b91-446d-4979-9f62-912ed57db323");
    expect(result?.country).toBe("GB");
    expect(result?.type).toBe("Group");
    expect(result?.score).toBe(1.0);
    expect(result?.tags).toEqual(["alternative rock", "art rock"]);
  });

  it("returns null when confidence score is below threshold", async () => {
    const mockLowConfidenceResponse = {
      artists: [
        {
          id: "some-random-id",
          name: "Unrelated Band",
          score: 20,
        },
      ],
    };

    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockLowConfidenceResponse,
    });

    const result = await adapter.searchArtist("Radiohead");
    expect(result).toBeNull();
  });

  it("parses release year and primary type for albums", async () => {
    const mockAlbumResponse = {
      releases: [
        {
          id: "album-mbid-123",
          title: "OK Computer",
          date: "1997-05-21",
          "release-group": {
            id: "release-group-mbid-456",
            "primary-type": "Album",
          },
        },
      ],
    };

    (globalThis.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockAlbumResponse,
    });

    const result = await adapter.searchAlbum("OK Computer", "cc197b91-446d-4979-9f62-912ed57db323");

    expect(result).not.toBeNull();
    expect(result?.mbid).toBe("album-mbid-123");
    expect(result?.releaseGroupMbid).toBe("release-group-mbid-456");
    expect(result?.releaseYear).toBe(1997);
    expect(result?.primaryType).toBe("Album");
  });
});

describe("MusicBrainzAdapter — indisponibilidade do provedor", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it("lança ProviderUnavailableError quando o socket cai em todas as tentativas", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw Object.assign(new TypeError("fetch failed"), { code: "UND_ERR_SOCKET" });
    }) as unknown as typeof fetch;

    const adapter = new MusicBrainzAdapter(undefined, { minDelayMs: 0, backoffBaseMs: 1 });
    await expect(adapter.searchArtist("Avril Lavigne")).rejects.toMatchObject({
      name: "ProviderUnavailableError",
      entityName: "Avril Lavigne",
    });
  });

  it("lança ProviderUnavailableError no 503 de limite de requisições", async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 503 }) as Response) as unknown as typeof fetch;

    const adapter = new MusicBrainzAdapter(undefined, { minDelayMs: 0, backoffBaseMs: 1 });
    await expect(adapter.searchAlbum("Under My Skin")).rejects.toMatchObject({
      name: "ProviderUnavailableError",
    });
  });

  it("devolve null (e não erro) quando o provedor responde 404", async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 404 }) as Response) as unknown as typeof fetch;

    const adapter = new MusicBrainzAdapter(undefined, { minDelayMs: 0, backoffBaseMs: 1 });
    await expect(adapter.searchArtist("Artista Que Nao Existe")).resolves.toBeNull();
  });

  it("recupera na segunda tentativa depois de uma queda de conexão", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new TypeError("fetch failed");
      return {
        ok: true,
        status: 200,
        json: async () => ({ releases: [{ id: "mbid-1", title: "Under My Skin", date: "2004-05-25" }] }),
      } as Response;
    }) as unknown as typeof fetch;

    const adapter = new MusicBrainzAdapter(undefined, { minDelayMs: 0, backoffBaseMs: 1 });
    const album = await adapter.searchAlbum("Under My Skin");

    expect(calls).toBe(2);
    expect(album?.releaseYear).toBe(2004);
  });
});
