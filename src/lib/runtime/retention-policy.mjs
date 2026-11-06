import { createHash } from "node:crypto";
const targets = {
  expiredSessions: { table: "AppSession", key: "tokenHash", time: "expiresAt", action: "DELETE" },
  expiredLoginLimits: { table: "AuthRateLimit", key: "key", time: "expiresAt", action: "DELETE" },
  abandonedGenerations: { table: "RecommendationSession", key: "id", time: "updatedAt", action: "FAIL" },
};
export function validateRetentionPolicy(value) {
  if (!value || value.version !== 1 || value.personalMemory !== "PRESERVE" || !Number.isInteger(value.batchSize) || value.batchSize < 1 || value.batchSize > 1000
    || Object.keys(value).some(key => !["version", "personalMemory", "batchSize", "scopes"].includes(key)) || !value.scopes || typeof value.scopes !== "object" || Array.isArray(value.scopes)) throw new Error("Invalid retention policy");
  if (Object.keys(value.scopes).some(key => !Object.hasOwn(targets, key))) throw new Error("Personal memory and unknown retention scopes are forbidden");
  const scopes = {};
  for (const name of Object.keys(targets)) {
    const hours = value.scopes[name] ?? null;
    if (hours !== null && (!Number.isInteger(hours) || hours < 1 || hours > 876000)) throw new Error("Explicit positive after-hours is required for enabled scopes");
    scopes[name] = hours;
  }
  return { version: 1, personalMemory: "PRESERVE", batchSize: value.batchSize, scopes };
}
/** @param {string | null} [target] */
export function retentionPlan(value, asOf, target = null) {
  const policy = validateRetentionPolicy(value);
  const date = new Date(asOf);
  if (!Number.isFinite(date.getTime()) || date.getTime() > Date.now() + 1000) throw new Error("Invalid or future retention as-of");
  const scopes = Object.entries(policy.scopes).filter(([, hours]) => hours !== null).map(([name, hours]) => ({ name,
    cutoff: new Date(date.getTime() - hours * 3600000).toISOString(), ...targets[name] }));
  const plan = { policy, asOf: date.toISOString(), scopes, target };
  return { ...plan, hash: createHash("sha256").update(JSON.stringify(plan)).digest("hex") };
}

/** No free-form identifiers or payloads. Per-target batches are atomic;
 * parallel invocations skip locked rows, and replay is safe.
 * @param {any} client
 * @param {any} value
 * @param {{asOf: string, apply?: boolean, expectedPlanHash?: string, databaseFingerprint?: string}} options
 */
export async function runRetention(client, value, options) {
  let plan = retentionPlan(value, options.asOf);
  let schema;
  if (plan.scopes.length) {
    if (!/^[a-f0-9]{64}$/i.test(options.databaseFingerprint ?? "")) throw new Error("Retention requires a database fingerprint");
    const [destination] = await client.$queryRawUnsafe('SELECT current_database()::text AS "database", current_schema()::text AS "schema"');
    if (typeof destination?.database !== "string" || typeof destination.schema !== "string" || !destination.schema) throw new Error("Retention could not identify its database schema");
    const target = createHash("sha256").update(JSON.stringify([options.databaseFingerprint.toLowerCase(), destination.database, destination.schema])).digest("hex");
    plan = retentionPlan(value, options.asOf, target);
    schema = `"${destination.schema.replaceAll('"', '""')}"`;
  }
  if (options.apply && options.expectedPlanHash !== plan.hash) throw new Error("Apply requires the reviewed dry-run plan hash for this destination and same as-of/policy");
  const results = [];
  for (const scope of plan.scopes) {
    const predicate = scope.action === "FAIL" ? ' AND "status" = \'GENERATING\'' : "";
    const where = `"${scope.time}" <= $1${predicate}`;
    const table = `${schema}."${scope.table}"`;
    const rows = await client.$queryRawUnsafe(`SELECT count(*)::int AS count FROM ${table} WHERE ${where}`, new Date(scope.cutoff));
    let changed = 0;
    if (options.apply) {
      const result = await client.$transaction(async tx => {
        const sql = `WITH picked AS (SELECT "${scope.key}" FROM ${table} WHERE ${where} ORDER BY "${scope.time}", "${scope.key}" LIMIT $2 FOR UPDATE SKIP LOCKED), changed AS (`
          + (scope.action === "FAIL" ? `UPDATE ${table} AS t SET "status" = 'FAILED', "updatedAt" = $3 FROM picked WHERE t."${scope.key}" = picked."${scope.key}" RETURNING 1`
            : `DELETE FROM ${table} AS t USING picked WHERE t."${scope.key}" = picked."${scope.key}" RETURNING 1`) + ") SELECT count(*)::int AS count FROM changed";
        return scope.action === "FAIL" ? tx.$queryRawUnsafe(sql, new Date(scope.cutoff), plan.policy.batchSize, new Date(plan.asOf))
          : tx.$queryRawUnsafe(sql, new Date(scope.cutoff), plan.policy.batchSize);
      });
      changed = result[0].count;
    }
    results.push({ scope: scope.name, cutoff: scope.cutoff, eligible: rows[0].count, changed, batchLimit: plan.policy.batchSize });
  }
  return { version: 1, dryRun: !options.apply, planHash: plan.hash, asOf: plan.asOf, personalMemory: "PRESERVE", results };
}
