import { describe, expect, it } from "vitest";
import { sourceSnapshots } from "./source-snapshots";
describe("exportable public sources", () => {
  it("whitelists provenance and keeps internal ranking diagnostics out", () => {
    const value = { provider: "lastfm", kind: "track", status: "AVAILABLE", artistName: "Banda", title: "Faixa", recordingVerified: false, requestedLanguage: "pt",
      fetchedAt: "2026-11-02T12:00:00.000Z", sourceUrl: "https://www.last.fm/music/Banda/_/Faixa", text: "Texto sintético de teste para verificar a atribuição explícita de uma fonte." };
    const result = sourceSnapshots({ secretDiagnostics: "private", evidence: ["internal"], culturalContext: { track: { ...value, rawPayload: "omit" }, album: { ...value, kind: "album", sourceUrl: "https://evil.test" } } });
    expect(result).toEqual({ albumEdition: null, culturalContext: { track: value } });
  });
});
