import { DeploymentPolicyError } from "@/lib/runtime/deployment-policy.mjs";

// Only fixed codes can leave this boundary. Never log the original exception,
// message, SQL, request body, connection URL or nested driver metadata.
export function loginFailureCode(error: unknown): string {
  const policyCodes = ["PREVIEW_DATABASE_URL_MISSING", "PRODUCTION_FINGERPRINT_MISSING", "PRODUCTION_FINGERPRINT_INVALID", "PREVIEW_DATABASE_URL_INVALID", "PREVIEW_POINTS_TO_PRODUCTION"];
  if (error instanceof DeploymentPolicyError && policyCodes.includes(error.code)) return error.code;
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
  const codes: Record<string, string> = {
    P1000: "DATABASE_AUTH_FAILED", P1001: "DATABASE_UNREACHABLE", P1002: "DATABASE_TIMEOUT",
    P1017: "DATABASE_CONNECTION_CLOSED", P2021: "DATABASE_TABLE_MISSING", P2022: "DATABASE_COLUMN_MISSING",
    ECONNREFUSED: "DATABASE_UNREACHABLE", ENOTFOUND: "DATABASE_UNREACHABLE", ETIMEDOUT: "DATABASE_TIMEOUT",
  };
  return typeof code === "string" && Object.hasOwn(codes, code) ? codes[code] : "LOGIN_OPERATION_FAILED";
}
