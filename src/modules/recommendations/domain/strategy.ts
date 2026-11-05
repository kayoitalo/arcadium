export type DiscoveryStrategy = "legacy" | "hybrid";
export function discoveryStrategy(): DiscoveryStrategy {
  return process.env.ARCADIUM_RECOMMENDATION_STRATEGY === "legacy" ? "legacy" : "hybrid";
}
export function algorithmVersion(strategy: DiscoveryStrategy): string {
  return strategy === "legacy" ? "v2-session-memory" : ALGORITHM_VERSION;
}
import { ALGORITHM_VERSION } from "./recommendation.types";
