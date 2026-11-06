import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({ test: { include: ["scripts/evaluation/discovery-replay.test.ts", "scripts/evaluation/narrative-comparison.test.ts", "scripts/evaluation/curated-catalog.test.ts"], alias: { "@": path.resolve(process.cwd(), "src") } } });
