import { describe, it, expect } from "vitest";
import fixture from "../../../../scripts/evaluation/discovery-replay.fixture.json";
import { evaluateDiscovery } from "./evaluation";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import manifest from "../evaluation/baseline-manifest.json";
describe("paired evaluation and missing judgments", () => {
  it("keeps the reviewed baseline snapshot immutable", () => {
    for (const file of manifest.files) expect(createHash("sha256").update(readFileSync(file.file)).digest("hex")).toBe(file.snapshotSha256);
  });
  it("reports undercoverage and adherence without converting novelty into interest", () => {
    const result = evaluateDiscovery(fixture);
    expect(result.engines.treatment.metrics.coverage).toBe(2 / 3);
    expect(result.engines.treatment.metrics.destinationAdherence).toBe(1);
    expect(result.engines.baseline.metrics.destinationAdherence).toBe(0);
    expect(result.engines.treatment.metrics.human.usefulSurprise).toEqual({ rate: null, judged: 0, unjudged: 2 });
    expect(result.engines.treatment.metrics.measurements.providerAttempts).toBeNull();
    expect(evaluateDiscovery(fixture).inputHash).toBe(result.inputHash);
  });
  it("separates observed human judgments from synthetic mechanism checks", () => {
    const judgment = { engine: "treatment", key: JSON.stringify(["synthetic dub a", "door (live)"]), adequate: true, interesting: false, usefulSurprise: null };
    expect(() => evaluateDiscovery({ ...fixture, judgments: [judgment] })).toThrow();
    const real = evaluateDiscovery({ ...fixture, provenance: "OBSERVED_SNAPSHOT", judgments: [judgment] });
    expect(real.engines.treatment.metrics.human.adequate).toEqual({ rate: 1, judged: 1, unjudged: 1 });
    expect(() => evaluateDiscovery({ ...fixture, provenance: "OBSERVED_SNAPSHOT", judgments: [judgment, judgment] })).toThrow();
  });
});
