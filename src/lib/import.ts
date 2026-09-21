/** Import helpers: URL structure outline, GitHub static site, ZIP. */
import JSZip from "jszip";

const UA = "Mozilla/5.0 (compatible; IDAEVIA-Build/1.0; +https://idaevia.app)";

function isPublicHttpUrl(u: string) {
  try {
    const url = new URL(u);
    if (!/^https?:$/.test(url.protocol)) return false;
    const h = url.hostname;
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[::1\])/.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}

const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");

export interface UrlOutline {
  url: string;
  title: string;
  description: string;
  lang: string;
  themeColor: string | null;
  fonts: string[];
  colors: string[];
  nav: string[];
  headings: { level: number; text: string }[];
  buttons: string[];
  paragraphs: string[];
  sections: number;
  images: number;
  hasPricing: boolean;
  hasFaq: boolean;
  hasTestimonials: boolean;
  hasForm: boolean;
}

export async function fetchUrlOutline(input: string): Promise<UrlOutline> {
  if (!isPublicHttpUrl(input)) throw new Error("Only public http(s) URLs can be imported.");
  const res = await fetch(input, { headers: { "User-Agent": UA, Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("html")) throw new Error("URL did not return an HTML page.");
  const html = (await res.text()).slice(0, 1_500_000);
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "");

  const title = decode(strip(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""));
  const description = decode(html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? html.match(/<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i)?.[1] ?? "");
  const lang = html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1] ?? "en";
  const themeColor = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']*)["']/i)?.[1] ?? null;
  const fonts = Array.from(new Set(Array.from(html.matchAll(/fonts\.googleapis\.com\/css2?\?family=([^"&']+)/g)).map((m) => decodeURIComponent(m[1]).replace(/\+/g, " ").split(":")[0]))).slice(0, 4);
  const colorCounts = new Map<string, number>();
  for (const m of html.matchAll(/#([0-9a-f]{6})\b/gi)) {
    const c = `#${m[1].toLowerCase()}`;
    if (["#ffffff", "#000000"].includes(c)) continue;
    colorCounts.set(c, (colorCounts.get(c) ?? 0) + 1);
  }
  const colors = Array.from(colorCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c]) => c);

  const navBlock = body.match(/<nav[\s\S]*?<\/nav>/i)?.[0] ?? body.match(/<header[\s\S]*?<\/header>/i)?.[0] ?? "";
  const nav = Array.from(new Set(Array.from(navBlock.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)).map((m) => decode(strip(m[1]))).filter((t) => t && t.length < 30))).slice(0, 10);
  const headings = Array.from(body.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)).map((m) => ({ level: Number(m[1]), text: decode(strip(m[2])) })).filter((h) => h.text).slice(0, 40);
  const buttons = Array.from(new Set(Array.from(body.matchAll(/<(?:button|a)[^>]*class=["'][^"']*(?:btn|button|cta)[^"']*["'][^>]*>([\s\S]*?)<\/(?:button|a)>/gi)).map((m) => decode(strip(m[1]))).filter((t) => t && t.length < 40))).slice(0, 10);
  const paragraphs = Array.from(body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)).map((m) => decode(strip(m[1]))).filter((t) => t.length > 40).slice(0, 12).map((t) => t.slice(0, 220));
  const lower = body.toLowerCase();
  return {
    url: input,
    title,
    description,
    lang,
    themeColor,
    fonts,
    colors,
    nav,
    headings,
    buttons,
    paragraphs,
    sections: (body.match(/<section\b/gi) ?? []).length,
    images: (body.match(/<img\b/gi) ?? []).length,
    hasPricing: /pricing|\/mo\b|per month/.test(lower),
    hasFaq: /faq|frequently asked/.test(lower),
    hasTestimonials: /testimonial|what our|customers say/.test(lower),
    hasForm: /<form\b/.test(lower),
  };
}

export function outlineToPrompt(o: UrlOutline, extra?: string) {
  return [
    `Rebuild an ORIGINAL website with the same structure and visual hierarchy as this reference (do not copy protected text, logos or images, write new copy in the same tone and use placeholders):`,
    `Reference: ${o.url}`,
    `Title: ${o.title}`,
    o.description && `Description: ${o.description}`,
    `Language: ${o.lang}`,
    o.themeColor && `Theme colour: ${o.themeColor}`,
    o.colors.length && `Dominant colours: ${o.colors.join(", ")}`,
    o.fonts.length && `Fonts: ${o.fonts.join(", ")}`,
    o.nav.length && `Navigation: ${o.nav.join(" · ")}`,
    o.headings.length && `Heading outline:\n${o.headings.map((h) => `${"  ".repeat(h.level - 1)}h${h.level}: ${h.text}`).join("\n")}`,
    o.buttons.length && `CTAs: ${o.buttons.join(" · ")}`,
    o.paragraphs.length && `Sample copy (tone reference only):\n- ${o.paragraphs.slice(0, 5).join("\n- ")}`,
    `Sections: ~${o.sections}, images: ${o.images}${o.hasPricing ? ", has pricing" : ""}${o.hasFaq ? ", has FAQ" : ""}${o.hasTestimonials ? ", has testimonials" : ""}${o.hasForm ? ", has a form" : ""}`,
    extra && `Additional instructions: ${extra}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Fetch index.html (or public/index.html, dist/index.html) from a public GitHub repo. */
export async function fetchGithubIndex(repoUrl: string): Promise<{ html: string; path: string; repo: string }> {
  const m = repoUrl.match(/github\.com\/([\w.-]+)\/([\w.-]+)(?:\/tree\/([\w.-\/]+))?/i);
  if (!m) throw new Error("Enter a GitHub repository URL like https://github.com/owner/repo");
  const owner = m[1];
  const repo = m[2].replace(/\.git$/, "");
  const ref = m[3] ?? "HEAD";
  const candidates = ["index.html", "public/index.html", "dist/index.html", "docs/index.html", "src/index.html"];
  for (const p of candidates) {
    const url = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${p}`;
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const html = await res.text();
      if (/<html[\s>]/i.test(html)) return { html, path: p, repo: `${owner}/${repo}` };
    }
  }
  throw new Error("No index.html found in the repository (checked root, public/, dist/, docs/, src/). Import a static site or use URL import for the deployed page.");
}

/** Read index.html + any .tsx/.ts files from an uploaded ZIP. */
export async function readZip(buf: ArrayBuffer): Promise<{ html: string | null; files: { path: string; content: string }[] }> {
  const zip = await JSZip.loadAsync(buf);
  let html: string | null = null;
  const files: { path: string; content: string }[] = [];
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir && !n.includes("node_modules/") && !n.startsWith("__MACOSX"));
  const index = names.find((n) => /(^|\/)index\.html$/i.test(n));
  if (index) html = await zip.files[index].async("string");
  for (const n of names) {
    if (/\.(tsx?|jsx?|css|json)$/i.test(n) && !/package(-lock)?\.json$/.test(n)) {
      const content = await zip.files[n].async("string");
      const rel = n.replace(/^[^/]*\/src\//, "/").replace(/^src\//, "/").replace(/^\/?/, "/");
      if (content.length < 200_000) files.push({ path: rel, content });
    }
  }
  return { html, files: files.slice(0, 60) };
}
