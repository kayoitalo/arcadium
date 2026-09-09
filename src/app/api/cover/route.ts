import { NextResponse } from "next/server";

/**
 * Espelha capas dos provedores na mesma origem.
 * Sem isto o canvas fica "tainted" e a extração de cor é impossível.
 * A lista de hosts é fechada: o parâmetro vem do cliente e não pode
 * virar um proxy aberto.
 */
const ALLOWED_HOSTS = new Set([
  "lastfm-img.freetls.fastly.net",
  "lastfm.freetls.fastly.net",
  "coverartarchive.org",
  "ia800000.us.archive.org",
  "i.scdn.co",
]);

function isAllowed(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  if (ALLOWED_HOSTS.has(url.hostname)) return true;
  return url.hostname.endsWith(".archive.org") || url.hostname.endsWith(".coverartarchive.org");
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("u");
  if (!raw) {
    return NextResponse.json({ error: "Missing 'u' parameter." }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  if (!isAllowed(target)) {
    return NextResponse.json({ error: "Host not allowed." }, { status: 403 });
  }

  try {
    const upstream = await fetch(target, {
      headers: { "User-Agent": "Grooveyard/0.1 (+cover-proxy)", Accept: "image/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "Upstream failed." }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json({ error: "Not an image." }, { status: 415 });
    }

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=604800, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Upstream unreachable." }, { status: 504 });
  }
}
