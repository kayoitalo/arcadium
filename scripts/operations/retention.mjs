import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { databaseConnectionString, databaseFingerprint } from "../../src/lib/runtime/deployment-policy.mjs";
import { runRetention } from "../../src/lib/runtime/retention-policy.mjs";

const { values } = parseArgs({ options: { policy: { type: "string", default: "scripts/operations/retention-policy.json" },
  "as-of": { type: "string" }, apply: { type: "boolean", default: false }, "plan-hash": { type: "string" } } });
if (!values["as-of"]) throw new Error("Supply --as-of ISO date; dry-run and apply must share the reviewed cutoff");
let client;
try {
  const connectionString = databaseConnectionString(); // Existing preview/production guard, no alternate URL fallback.
  client = new PrismaClient({ adapter: new PrismaPg({ connectionString }), log: [] });
  const policy = JSON.parse(await readFile(values.policy, "utf8"));
  console.log(JSON.stringify(await runRetention(client, policy, { asOf: values["as-of"], apply: values.apply,
    expectedPlanHash: values["plan-hash"], databaseFingerprint: databaseFingerprint(connectionString) }), null, 2));
} catch { console.error("Retention refused or failed. Check destination, policy, reviewed hash and database access. No connection details are logged."); process.exitCode = 1; }
finally { await client?.$disconnect(); }
