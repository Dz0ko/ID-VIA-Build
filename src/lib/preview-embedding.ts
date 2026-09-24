/**
 * The built project preview renders inside an iframe on the platform. A generated app that sends
 * X-Frame-Options or a CSP frame-ancestors list without the platform origin shows a blank frame,
 * while "Open preview" in a new tab works; the platform detects that from the response headers.
 */
export function platformOrigin(): string {
  try { return new URL(process.env.APP_URL || "https://idaevia.app").origin; } catch { return "https://idaevia.app"; }
}

/** Why the platform cannot embed a response, or null when the frame will render. */
export function frameBlockReason(headers: Headers, origin: string = platformOrigin()): string | null {
  const xfo = headers.get("x-frame-options")?.trim().toLowerCase();
  if (xfo === "deny" || xfo === "sameorigin") return `X-Frame-Options: ${xfo.toUpperCase()}`;
  const csp = headers.get("content-security-policy") ?? "";
  const directive = csp.split(";").map(part => part.trim()).find(part => /^frame-ancestors\b/i.test(part));
  if (!directive) return null;
  const sources = directive.replace(/^frame-ancestors\s*/i, "").split(/\s+/).filter(Boolean).map(s => s.replace(/^'|'$/g, "").toLowerCase());
  const host = new URL(origin).hostname;
  const allowed = sources.some(source => source === "*" || source === origin.toLowerCase() || source === `${new URL(origin).protocol}` || source === host || (source.startsWith("*.") && host.endsWith(source.slice(1))) || (source.startsWith("https://*.") && host.endsWith(source.slice("https://*".length))));
  return allowed ? null : `Content-Security-Policy ${directive}`;
}

/** The chat request that has the builder open the app to the platform preview. */
export function embedFixRequest(reason: string): string {
  return `The platform preview cannot embed this app in its iframe (${reason}). Allow embedding: do not send X-Frame-Options, and set the Content-Security-Policy frame-ancestors directive to 'self' plus the IDAEVIA_PLATFORM_ORIGIN environment variable when it is set (fallback ${platformOrigin()}). Keep every other security header and all other behaviour exactly as it is.`;
}
