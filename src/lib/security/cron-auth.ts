export interface CronAuthResult {
  authorized: boolean;
  error?: string;
}

/**
 * O mesmo endpoint atende dois chamadores: o agendador do GitHub Actions,
 * que manda o segredo no cabeçalho, e o botão "buscar agora" da ficha
 * técnica, que roda no navegador e não pode carregar segredo nenhum —
 * qualquer valor embutido no bundle deixaria de ser segredo.
 *
 * Por isso a requisição de dentro da própria página também vale como
 * autorizada. Sec-Fetch-Site é preenchido pelo navegador e é proibido a
 * scripts: uma página de terceiro consegue disparar o POST, mas ele chega
 * como cross-site, nunca como same-origin.
 */
function isSameOriginBrowserRequest(request: Request): boolean {
  if (request.headers.get("sec-fetch-site") !== "same-origin") return false;

  const origin = request.headers.get("origin");
  if (!origin) return false;

  // atrás de proxy (Vercel) o host público chega em x-forwarded-host
  const hosts = [request.headers.get("x-forwarded-host"), request.headers.get("host")].filter(
    (host): host is string => Boolean(host),
  );

  try {
    const originHost = new URL(origin).host;
    return hosts.includes(originHost);
  } catch {
    return false;
  }
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

  if (isSameOriginBrowserRequest(request)) {
    return { authorized: true };
  }

  return {
    authorized: false,
    error: "Unauthorized: Invalid or missing CRON_SECRET header.",
  };
}
