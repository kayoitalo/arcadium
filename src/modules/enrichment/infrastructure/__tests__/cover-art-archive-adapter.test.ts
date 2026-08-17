import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoverArtArchiveAdapter } from "../cover-art-archive-adapter";

describe("CoverArtArchiveAdapter", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));
  afterEach(() => vi.restoreAllMocks());

  it("returns the canonical 500px front-cover URL when available", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 307 } as Response);
    const result = await new CoverArtArchiveAdapter().findFrontCover("76df3287-6cda-33eb-8e9a-044b5e15ffdd");
    expect(result).toEqual({
      url: "https://coverartarchive.org/release/76df3287-6cda-33eb-8e9a-044b5e15ffdd/front-500",
      source: "cover-art-archive",
      entityType: "release",
      mbid: "76df3287-6cda-33eb-8e9a-044b5e15ffdd",
    });
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: "GET", redirect: "manual" }));
  });

  it("resolves a release-group front cover", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 307 } as Response);
    const result = await new CoverArtArchiveAdapter().findReleaseGroupFrontCover("48140466-cff6-3222-bd55-63c27e43190d");
    expect(result).toEqual(expect.objectContaining({
      entityType: "release-group",
      mbid: "48140466-cff6-3222-bd55-63c27e43190d",
      url: expect.stringContaining("/release-group/48140466-cff6-3222-bd55-63c27e43190d/front-500"),
    }));
  });

  it("stores the final archive URL when the redirect target is healthy", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 307, headers: new Headers({ location: "https://archive.example/cover.jpg" }) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    const result = await new CoverArtArchiveAdapter().findFrontCover("76df3287-6cda-33eb-8e9a-044b5e15ffdd");
    expect(result?.url).toBe("https://archive.example/cover.jpg");
  });

  it("retries a transient server error without following the image redirect", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 307 } as Response);

    const result = await new CoverArtArchiveAdapter().findFrontCover("76df3287-6cda-33eb-8e9a-044b5e15ffdd");
    expect(result?.source).toBe("cover-art-archive");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("returns null for missing art and invalid MBIDs", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 404 } as Response);
    const adapter = new CoverArtArchiveAdapter();
    expect(await adapter.findFrontCover("76df3287-6cda-33eb-8e9a-044b5e15ffdd")).toBeNull();
    expect(await adapter.findFrontCover("not-an-mbid")).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
