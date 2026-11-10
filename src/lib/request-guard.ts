import { NextResponse } from "next/server";

/**
 * Rejects browser requests that another site could forge against a running
 * StoreCanvas server (for example a local `pnpm dev` that writes the configured
 * project file or `public/screenshots/uploaded`).
 *
 * - The body must be declared as JSON. A cross-origin page can only send JSON
 *   with that content type after a CORS preflight, which these routes never
 *   approve, so form posts and `no-cors` fetches stop here.
 * - When the browser says where the request came from (`Sec-Fetch-Site` or
 *   `Origin`), it must be this same origin. `same-site` is not enough: another
 *   port on localhost is "same-site".
 *
 * Non-browser clients (the CLI, curl, tests) send neither header and are
 * unaffected as long as they send `content-type: application/json`.
 */
export function crossSiteRequestError(request: Request): { status: number; error: string } | null {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return { status: 415, error: "Send the request body as application/json." };
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return { status: 403, error: "Cross-site requests are not accepted." };
  }

  const origin = request.headers.get("origin");
  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return { status: 403, error: "Cross-site requests are not accepted." };
    }
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
    if (originHost.toLowerCase() !== host.split(",")[0].trim().toLowerCase()) {
      return { status: 403, error: "Cross-site requests are not accepted." };
    }
  }
  return null;
}

export function rejectCrossSiteRequest(request: Request) {
  const problem = crossSiteRequestError(request);
  if (!problem) return null;
  const response = NextResponse.json({ ok: false, error: problem.error }, { status: problem.status });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
