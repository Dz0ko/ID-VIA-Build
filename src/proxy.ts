import { NextResponse, type NextRequest } from "next/server";

/**
 * Request guard for API mutations and desktop landing redirects.
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
  // Presentation hint only: authentication still happens in layouts/API handlers.
  if (pathname === "/" && req.headers.get("user-agent")?.includes("IDAEVIA-Desktop/")) {
    const target = req.nextUrl.clone();
    target.pathname = "/app";
    const response = NextResponse.redirect(target);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Vary", "User-Agent");
    return response;
  }
  if (!pathname.startsWith("/api/")) {
    const response = NextResponse.next();
    response.headers.set("Vary", "User-Agent");
    return response;
  }
  if (!MUTATING.has(req.method) || EXEMPT.some((r) => r.test(pathname))) return NextResponse.next();

  const expectedOrigin = safeOrigin(process.env.APP_URL ?? req.nextUrl.origin);
  const site = req.headers.get("sec-fetch-site");
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  // An explicit Origin always wins over fetch metadata. A sibling subdomain
  // is same-site but is not trusted to perform authenticated mutations.
  let ok = false;
  if (origin) ok = safeOrigin(origin) === expectedOrigin;
  else if (referer) ok = safeOrigin(referer) === expectedOrigin;
  else if (site === "same-origin") ok = true;
  else if (!site) ok = true; // Non-browser clients still require handler authentication.

  if (!ok) return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  return NextResponse.next();
}

function safeOrigin(url: string) {
  try { return new URL(url).origin; } catch { return ""; }
}

export const config = { matcher: ["/", "/api/:path*"] };
