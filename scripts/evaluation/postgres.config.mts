import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({ test: { include: ["scripts/evaluation/postgres.integration.ts"], testTimeout: 30_000, hookTimeout: 30_000,
  alias: { "@": path.resolve(process.cwd(), "src") } } });
