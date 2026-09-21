import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: ["/", "/pricing", "/privacy", "/terms", "/cookies", "/login", "/signup"], disallow: ["/app", "/admin", "/api", "/portal", "/r/"] }],
    sitemap: "https://idaevia.app/sitemap.xml",
  };
}
