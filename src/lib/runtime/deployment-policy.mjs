import { createHash } from "node:crypto";

/** @param {Record<string, string | undefined>} [env] */
export function isPreview(env = process.env) {
  return env.VERCEL_ENV === "preview" || env.APP_ENV === "preview";
}

/** Identifies an endpoint without retaining credentials. Neon pooled/direct hosts share an identity.
 * @param {string} value */
export function databaseFingerprint(value) {
  const url = new URL(value);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.pathname.slice(1)) {
    throw new Error("Invalid PostgreSQL connection configuration");
  }
  const host = url.hostname.toLowerCase().replace(/-pooler(?=\.)/, "");
  return createHash("sha256").update(`${host}:${url.port || "5432"}/${decodeURIComponent(url.pathname.slice(1))}`).digest("hex");
}

/** Preview never falls back to DATABASE_URL. The production identity must be supplied separately.
 * This checks endpoints, not ownership; custom aliases require operator verification.
 * @param {Record<string, string | undefined>} [env] */
export function databaseConnectionString(env = process.env) {
  if (!isPreview(env)) {
    if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
    return env.DATABASE_URL;
  }
  const value = env.PREVIEW_DATABASE_URL;
  const production = env.PRODUCTION_DATABASE_FINGERPRINT;
  if (!value || !production || !/^[a-f0-9]{64}$/i.test(production)) {
    throw new Error("Preview requires an isolated PREVIEW_DATABASE_URL and production database fingerprint");
  }
  if (databaseFingerprint(value) === production.toLowerCase()) {
    throw new Error("Preview database must differ from production");
  }
  return value;
}

/** @param {Record<string, string | undefined>} [env] */
export function automaticAiAllowed(env = process.env) {
  return !isPreview(env);
}

/** Plain client generation is offline; generate --sql and database commands retain the guard.
 * @param {Record<string, string | undefined>} [env]
 * @param {string[]} [args] */
export function prismaDatasource(env = process.env, args = process.argv.slice(2)) {
  if (args[0] === "generate" && !args.some(arg => arg === "--sql" || arg.startsWith("--sql="))) {
    return undefined;
  }
  return { url: databaseConnectionString(env) };
}

/** Explicit manual generation stays disabled until provider-wide quota sharing is verified.
 * @param {Record<string, string | undefined>} [env] */
export function manualAiAllowed(env = process.env) {
  return !isPreview(env) || env.PREVIEW_MANUAL_AI_ENABLED === "true";
}
