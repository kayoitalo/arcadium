import { databaseFingerprint } from "./deployment-policy.mjs";
/** Dedicated destructive-test entry point. The allowlisted fingerprint must be
 * obtained independently from the operator-confirmed preview endpoint. */
/** @param {Record<string, string | undefined>} [env] */
export function isolatedDatabase(env = process.env) {
  const value = env.ARCADIUM_TEST_DATABASE_URL;
  const expected = env.ARCADIUM_TEST_DATABASE_FINGERPRINT;
  if (env.ARCADIUM_TEST_DATABASE_CONFIRMED !== "preview" || !value || !/^[a-f0-9]{64}$/i.test(expected ?? "")) throw new Error("Explicit isolated-preview confirmation and fingerprint required");
  const actual = databaseFingerprint(value);
  if (actual !== expected.toLowerCase()) throw new Error("Test destination differs from confirmed preview");
  if (env.PRODUCTION_DATABASE_FINGERPRINT?.toLowerCase() === actual || env.DATABASE_URL && databaseFingerprint(env.DATABASE_URL) === actual) throw new Error("Test target collides with an ambient database destination");
  const url = new URL(value);
  url.hostname = url.hostname.replace(/-pooler(?=\.)/, ""); // Same endpoint identity, session-scoped schema isolation.
  return url;
}
export function assertTestSchema(schema) {
  if (!/^arcadium_eval_[a-f0-9]{24}$/.test(schema ?? "")) throw new Error("Only disposable Arcadium evaluation schemas are allowed");
  return schema;
}
