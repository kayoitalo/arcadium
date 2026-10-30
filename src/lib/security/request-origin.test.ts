import { afterEach, describe, expect, it, vi } from "vitest";
import { isTrustedMutation } from "./request-origin";

afterEach(() => vi.unstubAllEnvs());
const request = (origin?: string, site = "same-origin") => new Request("https://grooveyard.app/api/sync", {
  method: "POST", headers: { ...(origin ? { origin } : {}), "sec-fetch-site": site },
});

describe("mutation origin", () => {
  it("accepts exact deployment and branch origins on Vercel previews without APP_ORIGIN", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("APP_ORIGIN", "");
    vi.stubEnv("VERCEL_URL", "arcadium-commit123-team.vercel.app");
    vi.stubEnv("VERCEL_BRANCH_URL", "arcadium-git-feature-team.vercel.app");
    expect(isTrustedMutation(request("https://arcadium-commit123-team.vercel.app"))).toBe(true);
    expect(isTrustedMutation(request("https://arcadium-git-feature-team.vercel.app"))).toBe(true);
    expect(isTrustedMutation(request("https://another-project.vercel.app"))).toBe(false);
    expect(isTrustedMutation(request("http://arcadium-commit123-team.vercel.app"))).toBe(false);
    expect(isTrustedMutation(request("https://arcadium-commit123-team.vercel.app", "cross-site"))).toBe(false);
    expect(isTrustedMutation(request())).toBe(false);
  });
  it("does not accept Vercel URLs as a production configuration fallback", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "");
    vi.stubEnv("VERCEL_URL", "arcadium-commit123-team.vercel.app");
    expect(isTrustedMutation(request("https://arcadium-commit123-team.vercel.app"))).toBe(false);
  });
  it("rejects malformed platform hosts and attacker forwarded headers on preview", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("APP_ORIGIN", "");
    vi.stubEnv("VERCEL_URL", "valid.vercel.app@attacker.app");
    vi.stubEnv("VERCEL_BRANCH_URL", "");
    expect(isTrustedMutation(new Request("https://attacker.app/api/sync", { method: "POST", headers: {
      origin: "https://attacker.app", "x-forwarded-host": "attacker.app", host: "attacker.app",
    } }))).toBe(false);
  });
  it("requires the configured HTTPS origin in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "https://grooveyard.app");
    expect(isTrustedMutation(request("https://grooveyard.app"))).toBe(true);
    expect(isTrustedMutation(request("https://attacker.app"))).toBe(false);
    expect(isTrustedMutation(request())).toBe(false);
    expect(isTrustedMutation(request("https://grooveyard.app", "cross-site"))).toBe(false);
  });
  it("fails closed when production configuration is missing or insecure", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", "");
    expect(isTrustedMutation(request("https://grooveyard.app"))).toBe(false);
    vi.stubEnv("APP_ORIGIN", "http://grooveyard.app");
    expect(isTrustedMutation(request("http://grooveyard.app"))).toBe(false);
  });
  it("allows the current development origin without trusting forwarded headers", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ORIGIN", "");
    expect(isTrustedMutation(request("https://grooveyard.app"))).toBe(true);
    expect(isTrustedMutation(new Request("http://localhost:3000/api/sync", { method: "POST", headers: {
      origin: "https://attacker.app", "x-forwarded-host": "attacker.app",
    } }))).toBe(false);
  });
});
