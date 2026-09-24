import { runtimeProfile } from "./runtime-profile";

/** Deterministic production audit of a single-file site (no AI needed). */

export interface AuditResult {
  scope?: "html" | "source";
  performance: number;
  seo: number;
  accessibility: number;
  security: number;
  codeQuality: number;
  mobile: number;
  overall: number;
  issues: { area: string; severity: "high" | "medium" | "low"; message: string }[];
}

export function auditHtml(html: string): AuditResult {
  const issues: AuditResult["issues"] = [];
  const has = (re: RegExp) => re.test(html);
  const count = (re: RegExp) => (html.match(re) ?? []).length;

  // SEO
  let seo = 100;
  if (!has(/<title>[^<]{3,}<\/title>/i)) { seo -= 25; issues.push({ area: "SEO", severity: "high", message: "Missing <title>." }); }
  if (!has(/<meta[^>]+name=["']description["']/i)) { seo -= 20; issues.push({ area: "SEO", severity: "high", message: "Missing meta description." }); }
  if (!has(/<meta[^>]+property=["']og:title["']/i)) { seo -= 10; issues.push({ area: "SEO", severity: "medium", message: "Missing Open Graph tags." }); }
  const h1s = count(/<h1[\s>]/gi);
  if (h1s === 0) { seo -= 15; issues.push({ area: "SEO", severity: "high", message: "No <h1> found." }); }
  if (h1s > 1) { seo -= 10; issues.push({ area: "SEO", severity: "medium", message: `Multiple <h1> (${h1s}).` }); }
  if (!has(/application\/ld\+json/i)) { seo -= 8; issues.push({ area: "SEO", severity: "low", message: "No structured data (JSON-LD)." }); }
  if (!has(/<html[^>]+lang=/i)) { seo -= 5; issues.push({ area: "SEO", severity: "low", message: "Missing html lang attribute." }); }

  // Accessibility
  let a11y = 100;
  const imgs = count(/<img\b/gi);
  const imgsNoAlt = count(/<img\b(?![^>]*\balt=)[^>]*>/gi);
  if (imgsNoAlt > 0) { a11y -= Math.min(30, imgsNoAlt * 6); issues.push({ area: "Accessibility", severity: "high", message: `${imgsNoAlt} of ${imgs} images have no alt attribute.` }); }
  if (!has(/<main[\s>]/i)) { a11y -= 10; issues.push({ area: "Accessibility", severity: "medium", message: "No <main> landmark." }); }
  if (!has(/<nav[\s>]/i)) { a11y -= 5; issues.push({ area: "Accessibility", severity: "low", message: "No <nav> landmark." }); }
  const btnNoLabel = count(/<button\b(?![^>]*aria-label)[^>]*>\s*<svg/gi);
  if (btnNoLabel > 0) { a11y -= 10; issues.push({ area: "Accessibility", severity: "medium", message: `${btnNoLabel} icon-only buttons without aria-label.` }); }
  if (has(/<input\b(?![^>]*\b(aria-label|id)=)/i) && !has(/<label/i)) { a11y -= 10; issues.push({ area: "Accessibility", severity: "medium", message: "Form inputs without labels." }); }
  if (!has(/prefers-reduced-motion/i) && has(/animation|transition/i)) { a11y -= 5; issues.push({ area: "Accessibility", severity: "low", message: "Animations without prefers-reduced-motion support." }); }

  // Performance
  let perf = 100;
  const kb = Buffer.byteLength(html, "utf8") / 1024;
  if (kb > 300) { perf -= 25; issues.push({ area: "Performance", severity: "high", message: `Document is ${kb.toFixed(0)} KB.` }); }
  else if (kb > 150) { perf -= 10; issues.push({ area: "Performance", severity: "medium", message: `Document is ${kb.toFixed(0)} KB.` }); }
  const lazy = count(/loading=["']lazy["']/gi);
  if (imgs > 3 && lazy < imgs - 2) { perf -= 15; issues.push({ area: "Performance", severity: "medium", message: "Below-the-fold images are not lazy-loaded." }); }
  const scripts = count(/<script[^>]+src=/gi);
  if (scripts > 4) { perf -= 10; issues.push({ area: "Performance", severity: "medium", message: `${scripts} external scripts.` }); }
  if (!has(/rel=["']preconnect["']/i) && has(/fonts\.googleapis/i)) { perf -= 5; issues.push({ area: "Performance", severity: "low", message: "No preconnect for Google Fonts." }); }

  // Security
  let sec = 100;
  if (has(/sk-[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|api[_-]?key\s*[:=]\s*["'][^"']{12,}/i)) { sec -= 50; issues.push({ area: "Security", severity: "high", message: "Possible secret/API key in the document." }); }
  if (has(/http:\/\/(?!localhost)/i)) { sec -= 15; issues.push({ area: "Security", severity: "medium", message: "Mixed content: insecure http:// resources." }); }
  if (has(/target=["']_blank["'](?![^>]*rel=)/i)) { sec -= 5; issues.push({ area: "Security", severity: "low", message: "target=_blank links without rel=noopener." }); }
  if (has(/eval\(|document\.write\(/i)) { sec -= 15; issues.push({ area: "Security", severity: "medium", message: "Use of eval/document.write." }); }

  // Code quality
  let cq = 100;
  const opens = count(/<div\b/gi);
  const closes = count(/<\/div>/gi);
  if (opens !== closes) { cq -= 20; issues.push({ area: "Code", severity: "high", message: `Unbalanced <div> tags (${opens} open / ${closes} close).` }); }
  if (!has(/<!doctype html/i)) { cq -= 15; issues.push({ area: "Code", severity: "high", message: "Missing <!DOCTYPE html>." }); }
  const ids = html.match(/\sid=["']([^"']+)["']/gi) ?? [];
  const dup = ids.length - new Set(ids.map((s) => s.toLowerCase())).size;
  if (dup > 0) { cq -= 10; issues.push({ area: "Code", severity: "medium", message: `${dup} duplicate id attributes.` }); }
  if (has(/lorem ipsum/i)) { cq -= 10; issues.push({ area: "Code", severity: "medium", message: "Placeholder text (lorem ipsum) found." }); }

  // Mobile
  let mobile = 100;
  if (!has(/<meta[^>]+name=["']viewport["']/i)) { mobile -= 40; issues.push({ area: "Mobile", severity: "high", message: "Missing viewport meta tag." }); }
  if (!has(/md:|lg:|sm:|@media/i)) { mobile -= 30; issues.push({ area: "Mobile", severity: "high", message: "No responsive breakpoints detected." }); }
  if (has(/width:\s*\d{4,}px/i)) { mobile -= 10; issues.push({ area: "Mobile", severity: "medium", message: "Fixed widths over 1000px." }); }

  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const r = {
    performance: clamp(perf),
    seo: clamp(seo),
    accessibility: clamp(a11y),
    security: clamp(sec),
    codeQuality: clamp(cq),
    mobile: clamp(mobile),
  };
  const overall = clamp((r.performance + r.seo + r.accessibility + r.security + r.codeQuality + r.mobile) / 6);
  return { ...r, overall, issues };
}

/** Source checks for app projects; never score an empty HTML field as a rendered app. */
export function auditProject(project: { kind: string; html: string; files: { path: string; content: string }[] }): AuditResult {
  if (project.kind !== "app") return { ...auditHtml(project.html), scope: "html" };
  const issues: AuditResult["issues"] = [];
  const profile = runtimeProfile(project.files);
  if (profile.issue) issues.push({ area: "Runtime", severity: "high", message: profile.issue });
  for (const file of project.files) {
    if (/^(?:<<<<<<< |>>>>>>> )/m.test(file.content)) issues.push({ area: "Code", severity: "high", message: `${file.path}: unresolved merge conflict markers.` });
    if (/(?:^|\/)(?:package|composer|vercel|runtime)\.json$/.test(file.path)) {
      try { JSON.parse(file.content); } catch { issues.push({ area: "Code", severity: "high", message: `${file.path}: invalid JSON configuration.` }); }
    }
    if (/\.prisma$/.test(file.path)) {
      // Prisma accepts one enum value per line; several on one line fail `prisma generate` with "not an enum value definition".
      const bad = [...file.content.matchAll(/^\s*enum\s+\w+\s*\{([^}]*)\}/gm)].filter(m => m[1].split("\n").some(line => /^\s*[A-Za-z_]\w*(?:\s+[A-Za-z_]\w*)+\s*(?:\/\/.*)?$/.test(line) && !/@map|@@/.test(line)));
      if (bad.length) issues.push({ area: "Code", severity: "high", message: `${file.path}: enum values must be one per line (${bad.length} enum${bad.length === 1 ? "" : "s"} with several values on one line); prisma generate rejects the schema.` });
      if (!/^\s*datasource\s+\w+\s*\{/m.test(file.content) || !/^\s*generator\s+\w+\s*\{/m.test(file.content)) issues.push({ area: "Code", severity: "high", message: `${file.path}: a Prisma schema needs both a datasource and a generator block.` });
    }
    if (!/\.(tsx|jsx|html|vue|svelte)$/.test(file.path)) continue;
    if (/<img\b(?![^>]*\balt\s*=)[^>]*>/i.test(file.content)) issues.push({ area: "Accessibility", severity: "medium", message: `${file.path}: image without an alt attribute. Check whether it needs descriptive text or alt="".` });
    if (/<html\b(?![^>]*\blang\s*=)[^>]*>/i.test(file.content)) issues.push({ area: "Accessibility", severity: "medium", message: `${file.path}: root html element has no lang attribute.` });
  }
  return { scope: "source", performance: 0, seo: 0, accessibility: 0, security: 0, codeQuality: 0, mobile: 0, overall: 0, issues };
}

export function auditSummary(result: AuditResult) {
  return `${result.scope === "source" ? "Source checks" : "HTML checks"}: ${result.issues.length} remaining finding(s). ${result.issues.length ? result.issues.map(i => i.message).join(" ") : "No findings in these checks."} Build, runtime behavior and visual quality still require validation.`;
}
