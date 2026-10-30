/** Production uses APP_ORIGIN; preview also accepts its exact Vercel-provided hosts.
 * Never trust Host/forwarded headers or all *.vercel.app deployments. */
export function isTrustedMutation(request: Request): boolean {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (!origin || (site && site !== "same-origin" && site !== "none")) return false;
  try {
    const configured = process.env.APP_ORIGIN;
    const expected: string[] = [];
    if (process.env.VERCEL_ENV === "preview") {
      for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]) {
        if (host && /^[a-z0-9.-]+$/i.test(host)) expected.push(new URL(`https://${host}`).origin);
      }
    }
    if (configured) {
      const explicit = new URL(configured);
      if (process.env.NODE_ENV !== "production" || explicit.protocol === "https:") expected.push(explicit.origin);
    }
    if (expected.length === 0 && process.env.NODE_ENV !== "production") expected.push(new URL(request.url).origin);
    return expected.includes(new URL(origin).origin);
  } catch { return false; }
}
