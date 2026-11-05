import { describe, expect, it } from "vitest";
import { isolatedDatabase, assertTestSchema } from "./isolated-database.mjs";
import { databaseFingerprint } from "./deployment-policy.mjs";
describe("isolated PostgreSQL tests", () => {
  it("fails closed for missing, mismatched or ambient production identity", () => {
    const url = "postgresql://fake:fake@test.example/test"; const fingerprint = databaseFingerprint(url);
    const env = { ARCADIUM_TEST_DATABASE_URL: url, ARCADIUM_TEST_DATABASE_FINGERPRINT: fingerprint, ARCADIUM_TEST_DATABASE_CONFIRMED: "preview" };
    expect(isolatedDatabase(env).hostname).toBe("test.example");
    expect(() => isolatedDatabase({ ...env, ARCADIUM_TEST_DATABASE_CONFIRMED: "" })).toThrow();
    expect(() => isolatedDatabase({ ...env, ARCADIUM_TEST_DATABASE_URL: url.replace("test.example", "prod.example") })).toThrow();
    expect(() => isolatedDatabase({ ...env, PRODUCTION_DATABASE_FINGERPRINT: fingerprint })).toThrow();
    expect(() => isolatedDatabase({ ...env, DATABASE_URL: url })).toThrow();
    for (const value of ["public", "arcadium_eval_x", 'arcadium_eval_";DROP SCHEMA public']) expect(() => assertTestSchema(value)).toThrow();
  });
});
