import { describe, expect, it } from "vitest";
import { automaticAiAllowed, databaseConnectionString, databaseFingerprint, manualAiAllowed } from "./deployment-policy.mjs";

const production = "postgresql://owner:secret@ep-main.neon.tech/music?sslmode=require";
const preview = "postgresql://owner:another@ep-preview.neon.tech/music?sslmode=require";
const fingerprint = databaseFingerprint(production);

describe("isolated preview deployment", () => {
  it("does not silently use production when preview configuration is absent", () => {
    expect(() => databaseConnectionString({ VERCEL_ENV: "preview", DATABASE_URL: production })).toThrow("isolated");
    expect(() => databaseConnectionString({ APP_ENV: "preview", PREVIEW_DATABASE_URL: preview })).toThrow("fingerprint");
  });
  it("rejects the same database through changed credentials, query parameters or pooled host", () => {
    for (const value of [production, "postgresql://other:password@ep-main-pooler.neon.tech/music?connect_timeout=5"]) {
      expect(() => databaseConnectionString({ VERCEL_ENV: "preview", PREVIEW_DATABASE_URL: value, PRODUCTION_DATABASE_FINGERPRINT: fingerprint })).toThrow("differ");
    }
  });
  it("uses the separate preview endpoint and keeps normal production configuration", () => {
    expect(databaseConnectionString({ VERCEL_ENV: "preview", DATABASE_URL: production, PREVIEW_DATABASE_URL: preview, PRODUCTION_DATABASE_FINGERPRINT: fingerprint })).toBe(preview);
    expect(databaseConnectionString({ VERCEL_ENV: "production", DATABASE_URL: production })).toBe(production);
  });
  it("rejects malformed database identity without exposing its value", () => {
    expect(() => databaseFingerprint("https://example.com/music")).toThrow("Invalid PostgreSQL");
    expect(() => databaseConnectionString({ APP_ENV: "preview", PREVIEW_DATABASE_URL: preview, PRODUCTION_DATABASE_FINGERPRINT: "unknown" })).toThrow("fingerprint");
  });
  it("disables automatic AI even when manual generation is explicitly enabled", () => {
    const env = { VERCEL_ENV: "preview", PREVIEW_MANUAL_AI_ENABLED: "true" };
    expect(automaticAiAllowed(env)).toBe(false);
    expect(manualAiAllowed(env)).toBe(true);
    expect(manualAiAllowed({ VERCEL_ENV: "preview" })).toBe(false);
    expect(automaticAiAllowed({ VERCEL_ENV: "production" })).toBe(true);
  });
});
