import { describe, expect, it, vi } from "vitest";
import { retentionPlan, runRetention, validateRetentionPolicy } from "./retention-policy.mjs";
const policy = { version: 1, personalMemory: "PRESERVE", batchSize: 2, scopes: { expiredSessions: null, expiredLoginLimits: null, abandonedGenerations: null } };
describe("explicit operational retention", () => {
  it("has no default deadline and no automatic personal-memory deletion", async () => {
    const db = { $queryRawUnsafe: vi.fn(), $transaction: vi.fn() };
    expect((await runRetention(db, policy, { asOf: "2026-01-01T00:00:00Z" })).results).toEqual([]);
    expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
    for (const scopes of [{ listeningEvents: 24 }, { expiredSessions: 0 }, { expiredSessions: -1 }, { expiredSessions: "1" }]) expect(() => validateRetentionPolicy({ ...policy, scopes })).toThrow();
    expect(() => validateRetentionPolicy({ ...policy, personalMemory: "DELETE" })).toThrow();
  });
  it("pins policy, scope and cutoff before apply, with bounded skip-locked work", async () => {
    const configured = { ...policy, scopes: { expiredSessions: 24, abandonedGenerations: 1 } };
    const asOf = "2026-01-01T00:00:00Z"; const plan = retentionPlan(configured, asOf);
    const db = { $queryRawUnsafe: vi.fn().mockResolvedValue([{ count: 2 }]), $transaction: vi.fn() };
    db.$transaction.mockImplementation((fn) => fn(db));
    await expect(runRetention(db, configured, { asOf, apply: true, expectedPlanHash: "bad" })).rejects.toThrow();
    expect(db.$queryRawUnsafe).not.toHaveBeenCalled();
    const dry = await runRetention(db, configured, { asOf }); expect(dry.results.every((row) => row.changed === 0)).toBe(true);
    await runRetention(db, configured, { asOf, apply: true, expectedPlanHash: plan.hash });
    const writes = db.$queryRawUnsafe.mock.calls.filter(([sql]) => sql.includes("WITH picked"));
    expect(writes).toHaveLength(2); expect(writes.every(([sql]) => sql.includes("FOR UPDATE SKIP LOCKED") && !sql.includes("User\""))).toBe(true);
    expect(writes[1][0]).toContain('"status" = \'GENERATING\''); expect(writes[1][0]).toContain("'FAILED'");
    expect(retentionPlan({ ...configured, batchSize: 3 }, asOf).hash).not.toBe(plan.hash);
  });
});
