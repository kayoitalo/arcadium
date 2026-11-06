import { describe, it, expect } from "vitest";
import { prepareNarrativeComparison, assessNarrativeOutput } from "./narrative-comparison";
const input = { id: "synthetic", provenance: "SYNTHETIC", artistName: "Synthetic Band", trackName: "Synthetic Track (Live)",
  models: { lite: "configured-lite", flash: "configured-flash" }, evidence: [{ id: "a", scope: "album", statement: "Synthetic album fact.", sourceUrl: "https://www.last.fm/music/Synthetic/Album", fetchedAt: "2026-11-04T00:00:00Z" }] };
describe("offline blinded Lite/Flash preparation", () => {
  it("uses the identical versioned prompt, stable order, and zero provider calls", () => {
    const a = prepareNarrativeComparison(input); const b = prepareNarrativeComparison(input);
    expect(a).toEqual(b); expect(a.conditions).toMatchObject({ automaticCalls: false, providerAttempts: 0, tokenUsage: null });
    expect(prepareNarrativeComparison({ ...input, trackName: "Another" }).inputHash).not.toBe(a.inputHash);
  });
  it("rejects invented sources and album-to-recording scope laundering without claiming entailment", () => {
    expect(assessNarrativeOutput(input, { blocks: [{ text: "Fiction", scope: "catalog-track", evidenceIds: ["a", "invented"] }] })).toMatchObject({ validContract: false, humanReviewRequired: true });
    expect(assessNarrativeOutput(input, { blocks: [{ text: "Still needs factual review", scope: "album", evidenceIds: ["a"] }] })).toMatchObject({ validContract: true, humanReviewRequired: true });
  });
});
