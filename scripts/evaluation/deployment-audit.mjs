import { databaseConnectionString, databaseFingerprint, automaticAiAllowed, manualAiAllowed, isPreview } from "../../src/lib/runtime/deployment-policy.mjs";

const report = { schemaVersion: 1, preview: isPreview(), automaticAi: automaticAiAllowed(), manualAi: manualAiAllowed(),
  configured: Object.fromEntries(["DATABASE_URL", "PREVIEW_DATABASE_URL", "PRODUCTION_DATABASE_FINGERPRINT", "APP_ORIGIN", "AUTH_USER_ID", "LASTFM_API_KEY", "GEMINI_API_KEY", "SPOTIFY_CLIENT_ID", "SPOTIFY_REDIRECT_URI"].map(key => [key, Boolean(process.env[key])])) };
try {
  report.databaseFingerprint = databaseFingerprint(databaseConnectionString());
  report.databasePolicy = "accepted";
} catch {
  report.databasePolicy = "rejected";
  process.exitCode = 1;
}
console.log(JSON.stringify(report, null, 2));
