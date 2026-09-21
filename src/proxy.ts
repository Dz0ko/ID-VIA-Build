import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge guard that runs before every API request.
 *
 * CSRF: a state-changing request (POST/PUT/PATCH/DELETE) must come from our own
 * origin. Browsers always send `Sec-Fetch-Site` and/or `Origin`, so a request
 * forged from another site is rejected before it reaches any handler. Webhooks
 * and cron endpoints are exempt (they authenticate with signatures / secrets).
 */
const EXEMPT = [/^\/api\/webhooks\//, /^\/api\/cron\//];
const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!MUTATING.has(req.method) || EXEMPT.some((r) => r.test(pathname))) return NextResponse.next();

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const site = req.headers.get("sec-fetch-site");
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  let ok = false;
  if (site === "same-origin" || site === "same-site" || site === "none") ok = true;
  else if (origin) ok = safeHost(origin) === host;
  else if (referer) ok = safeHost(referer) === host;
  else if (!site) ok = true; // non-browser client without fetch metadata (curl, server-to-server); auth still applies

  if (!ok) return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  return NextResponse.next();
}

function safeHost(url: string) {
  try { return new URL(url).host; } catch { return ""; }
}

export const config = { matcher: "/api/:path*" };
