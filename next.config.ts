import type { NextConfig } from "next";
import tempoNextjsPlugin from "tempo-sdk/nextjs";

/**
 * Browser-side hardening. Scripts still need 'unsafe-inline'/'unsafe-eval'
 * (Next.js runtime, Monaco, Sandpack), so the real protection is server-side;
 * these headers stop clickjacking, base-tag hijacks, form exfiltration and MIME sniffing.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // cdn.tailwindcss.com / esm.sh: generated sites previewed via srcDoc inherit this policy.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://t.whop.tw https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com https://esm.sh https://*.codesandbox.io https://*.csb.app",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
      "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
      "img-src 'self' data: blob: https:",
      "media-src 'self' data: blob: https:",
      "connect-src 'self' https: wss:",
      "frame-src 'self' blob: data: https://*.codesandbox.io https://*.csb.app https://whop.com https://*.whop.com",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://accounts.google.com https://github.com https://whop.com",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Prisma + native deps must stay external to the server bundle.
  serverExternalPackages: ["@prisma/client", "prisma", "bcryptjs"],
  async headers() {
    return [
      // User-generated HTML gets its own (sandboxed) policy in the route handlers.
      { source: "/((?!s/|api/portal/|api/templates/|api/projects/[^/]+/preview|api/marketplace/[^/]+/preview).*)", headers: securityHeaders },
    ];
  },
};

// Tempo canvas instrumentation: no-ops unless TEMPO=true (set by the Tempo app runner).
const withTempo = tempoNextjsPlugin();
export default withTempo(nextConfig as Parameters<typeof withTempo>[0]) as NextConfig;
