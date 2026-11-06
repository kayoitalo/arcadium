import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { isolatedDatabase, assertTestSchema } from "../../src/lib/runtime/isolated-database.mjs";
const require = createRequire(import.meta.url);
const url = isolatedDatabase();
const schema = assertTestSchema(`arcadium_eval_${randomBytes(12).toString("hex")}`);
const admin = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.href }), log: [] });
const run = (entry, args, env) => new Promise((resolve, reject) => {
  const child = spawn(process.execPath, [entry, ...args], { env, windowsHide: true, stdio: "inherit" });
  child.once("error", reject); child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Isolated check failed")));
});
let created = false;
try {
  await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`); created = true;
  url.searchParams.set("schema", schema);
  const env = { ...process.env, DATABASE_URL: url.href, APP_ENV: "isolated-test", VERCEL_ENV: "", ARCADIUM_TEST_SCHEMA: schema };
  console.log("Applying versioned migrations only to a newly created disposable preview schema.");
  await run(require.resolve("prisma/build/index.js"), ["migrate", "deploy"], env);
  await run(require.resolve("prisma/build/index.js"), ["migrate", "diff", "--from-config-datasource", "--to-schema", "prisma/schema.prisma", "--exit-code"], env);
  await run(path.join(path.dirname(require.resolve("vitest/package.json")), "vitest.mjs"), ["run", "--config", "scripts/evaluation/postgres.config.mts"], env);
} catch { console.error("Isolated PostgreSQL checks failed. No connection details are logged."); process.exitCode = 1; }
finally {
  if (created) { assertTestSchema(schema); await admin.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`); console.log("Disposable evaluation schema removed."); }
  await admin.$disconnect();
}
