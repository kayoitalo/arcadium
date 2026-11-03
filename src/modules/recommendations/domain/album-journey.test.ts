import { describe, expect, it } from "vitest";
import { catalogURL, parseAlbumEdition, parseEdition } from "./album-journey";
import { discoveryContextSchema } from "./discovery-intent";
const at = "2026-11-02T12:00:00.000Z";
const album = () => ({ wrapperType: "collection", collectionId: 42, artistName: "Banda", collectionName: "Disco (Ao vivo)", trackCount: 3,
  collectionViewUrl: "https://music.apple.com/br/album/42", artworkUrl100: "https://is1-ssl.mzstatic.com/image/100x100bb.jpg" });
const songs = () => [1, 2, 3].map((i) => ({ wrapperType: "track", kind: "song", trackId: i, collectionId: 42, collectionName: "Disco (Ao vivo)", artistName: "Banda",
  trackName: `Faixa ${i} (Ao vivo)`, discNumber: i === 3 ? 2 : 1, discCount: 2, trackNumber: i === 3 ? 1 : i,
  previewUrl: "https://audio-ssl.itunes.apple.com/preview.m4a", trackViewUrl: `https://music.apple.com/br/song/${i}` }));
describe("an explicit album edition", () => {
  it("orders discs and tracks using one collection, preserves recording titles and upscales artwork", () => {
    const result = parseAlbumEdition([songs()[2], album(), songs()[1], songs()[0]], "42", "BR", at)!;
    expect(result.tracks.map((row) => [row.disc, row.number, row.trackName])).toEqual([[1, 1, "Faixa 1 (Ao vivo)"], [1, 2, "Faixa 2 (Ao vivo)"], [2, 1, "Faixa 3 (Ao vivo)"]]);
    expect(result.album.artworkUrl).toContain("600x600bb"); expect(result.album.fetchedAt).toBe(at);
  });
  it.each(["missing", "duplicate", "gap", "foreign-collection", "foreign-title", "missing-disc", "inconsistent-disc-count", "video", "too-long"])("refuses %s without silently truncating or filling from another edition", (problem) => {
    const a = album(); const rows = songs();
    if (problem === "missing") rows.pop();
    if (problem === "duplicate") rows[1].trackId = rows[0].trackId;
    if (problem === "gap") rows[1].trackNumber = 3;
    if (problem === "foreign-collection") rows[1].collectionId = 99;
    if (problem === "foreign-title") rows[1].collectionName = "Disco";
    if (problem === "missing-disc") rows[0].discNumber = rows[1].discNumber = 2;
    if (problem === "inconsistent-disc-count") rows[1].discCount = 3;
    if (problem === "video") rows[1].kind = "music-video";
    if (problem === "too-long") a.trackCount = 81;
    expect(parseAlbumEdition([a, ...rows], "42", "BR", at)).toBeNull();
  });
  it("keeps a track with absent preview without substituting an unsafe URL", () => {
    const rows = songs(); rows[0].previewUrl = "https://apple.com.attacker.test/audio";
    expect(parseAlbumEdition([album(), ...rows], "42", "BR", at)!.tracks[0].previewUrl).toBeNull();
    expect(catalogURL("javascript:alert(1)")).toBeNull(); expect(catalogURL("https://x@music.apple.com/42")).toBeNull();
    expect(parseEdition({ ...album(), collectionViewUrl: "https://example.test/42" }, "BR", at)).toBeNull();
  });
  it("requires edition metadata and album intent together", () => {
    const summary = parseEdition(album(), "BR", at)!;
    expect(discoveryContextSchema.safeParse({ version: 1, intent: "ALBUM", journey: { action: "ALBUM", album: summary } }).success).toBe(true);
    expect(discoveryContextSchema.safeParse({ version: 1, intent: "ALBUM", journey: { action: "ENTRY" } }).success).toBe(false);
    expect(discoveryContextSchema.safeParse({ version: 1, intent: "DISCOVER", journey: { action: "ENTRY", album: summary } }).success).toBe(false);
  });
  it("keeps the catalog advisory so a cleaned edition can be distinguished explicitly", () => {
    expect(parseEdition({ ...album(), collectionExplicitness: "cleaned" }, "BR", at)?.explicitness).toBe("cleaned");
    expect(parseEdition({ ...album(), collectionExplicitness: "explicit" }, "BR", at)?.explicitness).toBe("explicit");
  });
});
