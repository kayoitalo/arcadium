export interface CronAuthResult {
  authorized: boolean;
  error?: string;
}

export function verifyCronAuth(request: Request): CronAuthResult {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || process.env.NODE_ENV === "development") {
    return { authorized: true };
  }

  const authHeader = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-cron-secret");

  const providedToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : cronHeader;

  if (providedToken === cronSecret) {
    return { authorized: true };
  }

  return {
    authorized: false,
    error: "Unauthorized: Invalid or missing CRON_SECRET header.",
  };
}
