import { it, expect } from "vitest";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { evaluateDiscovery } from "../../src/modules/recommendations/domain/evaluation";
it("replays a validated paired snapshot without providers, AI or personal-data publication", () => {
  const input = JSON.parse(readFileSync(process.env.ARCADIUM_EVALUATION_INPUT ?? "scripts/evaluation/discovery-replay.fixture.json", "utf8"));
  const result = evaluateDiscovery(input);
  mkdirSync(".local/evaluation", { recursive: true });
  writeFileSync(".local/evaluation/discovery-replay.json", JSON.stringify(result, null, 2));
  expect(result.engines.treatment.metrics.coverage).toBeLessThanOrEqual(1);
  expect(result.inputHash).toHaveLength(64);
});
