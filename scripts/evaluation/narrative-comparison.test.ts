import { it, expect } from "vitest";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { prepareNarrativeComparison, assessNarrativeOutput } from "../../src/modules/recommendations/domain/narrative-comparison";
it("prepares or assesses an offline comparison with no SDK calls", () => {
  const input = JSON.parse(readFileSync(process.env.ARCADIUM_NARRATIVE_INPUT ?? "scripts/evaluation/narrative-comparison.fixture.json", "utf8"));
  const prepared = prepareNarrativeComparison(input);
  const outputs = process.env.ARCADIUM_NARRATIVE_OUTPUTS ? JSON.parse(readFileSync(process.env.ARCADIUM_NARRATIVE_OUTPUTS, "utf8")) : null;
  const result = { ...prepared, assessments: outputs ? { A: assessNarrativeOutput(input, outputs.A), B: assessNarrativeOutput(input, outputs.B) } : null };
  mkdirSync(".local/evaluation", { recursive: true }); writeFileSync(".local/evaluation/narrative-comparison.json", JSON.stringify(result, null, 2));
  expect(prepared.conditions.providerAttempts).toBe(0);
});
