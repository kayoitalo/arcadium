import { NextResponse } from "next/server";
/** Browser downloads must return expired sessions to sign-in, not a JSON file. */
export function privateDownloadFailure(request: Request, response: Response): Response {
  if (response.status === 401 && new URL(request.url).searchParams.get("download") === "1"
    && (request.headers.get("sec-fetch-mode") === "navigate" || request.headers.get("accept")?.includes("text/html"))) {
    const redirect = NextResponse.redirect(new URL("/login?expired=1", request.url));
    redirect.headers.set("Cache-Control", "private, no-store"); return redirect;
  }
  return response;
}
