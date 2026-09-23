/** Import helpers: URL structure outline, GitHub static site, ZIP. */
import JSZip from "jszip";
import { BINARY_PREFIX, fileBytes } from "./file-content";
import { Readable } from "node:stream";
import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { posix } from "node:path";

const UA = "Mozilla/5.0 (compatible; IDAEVIA-Build/1.0; +https://idaevia.app)";

/** Is this IP (v4 or v6) private, loopback, link-local (cloud metadata) or otherwise not public? */
function isPrivateIp(ip: string) {
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v6 === "::" || v6 === "::1") return true;
  if (v6.startsWith("::ffff:")) {
    const tail = v6.slice(7); if (tail.includes(".")) return isPrivateIp(tail);
    const parts = tail.split(":"); if (parts.length !== 2) return true;
    const n = (parseInt(parts[0], 16) * 65536) + parseInt(parts[1], 16);
    return isPrivateIp(`${Math.floor(n / 16777216)}.${Math.floor(n / 65536) % 256}.${Math.floor(n / 256) % 256}.${n % 256}`);
  }
  return !/^[23]/.test(v6) || /^(fc|fd|fe[89ab])/.test(v6) || v6.startsWith("64:ff9b") || v6.startsWith("2001:db8");
}

/**
 * SSRF guard: only http(s), only a hostname that resolves exclusively to public
 * addresses (so DNS names for internal services and cloud metadata are rejected too).
 */
async function assertPublicHttpUrl(u: string) {
  const url = new URL(u);
  if (!/^https?:$/.test(url.protocol)) throw new Error("Only public http(s) URLs can be imported.");
  if (url.username || url.password) throw new Error("URLs with credentials are not allowed.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) throw new Error("Only public http(s) URLs can be imported.");
  if (/^[\d.]+$/.test(host) || host.includes(":")) {
    if (isPrivateIp(host)) throw new Error("Only public http(s) URLs can be imported.");
    return url;
  }
  const { lookup } = await import("node:dns/promises");
  const addrs = await lookup(host, { all: true }).catch(() => []);
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("Only public http(s) URLs can be imported.");
  return url;
}

/** fetch() that re-validates every redirect hop against the SSRF guard. */
async function fetchPublic(input: string, init: RequestInit, maxHops = 4): Promise<Response> {
  let current = input;
  for (let hop = 0; hop <= maxHops; hop++) {
    const url = await assertPublicHttpUrl(current);
    const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ""), { all: true });
    if (!addresses.length || addresses.some(a => isPrivateIp(a.address))) throw new Error("Only public http(s) URLs can be imported.");
    // Pin the validated address to the actual connection, including redirect hops.
    const res = await new Promise<Response>((resolve, reject) => {
      const headers = Object.fromEntries(new Headers(init.headers).entries());
      const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, { headers: { ...headers, "Accept-Encoding": "identity" }, signal: init.signal ?? undefined, family: addresses[0].family, lookup: (_host, _options, callback) => callback(null, addresses[0].address, addresses[0].family) }, response => {
        const responseHeaders = new Headers();
        for (const [key, value] of Object.entries(response.headers)) if (value !== undefined) responseHeaders.set(key, Array.isArray(value) ? value.join(", ") : value);
        if (responseHeaders.get("content-encoding") && responseHeaders.get("content-encoding") !== "identity") { response.destroy(); reject(new Error("The website returned an unsupported compressed response. Try screenshot import.")); return; }
        const status = response.statusCode ?? 502;
        if ([204, 205, 304].includes(status)) { response.resume(); resolve(new Response(null, { status, headers: responseHeaders })); }
        else resolve(new Response(Readable.toWeb(response) as ReadableStream<Uint8Array>, { status, headers: responseHeaders }));
      });
      request.on("error", reject); request.end();
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      await res.body?.cancel();
      current = new URL(res.headers.get("location")!, current).toString();
      continue;
    }
    return res;
  }
  throw new Error("Too many redirects.");
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
  const res = await fetchPublic(input, { headers: { "User-Agent": UA, Accept: "text/html" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("html")) throw new Error("URL did not return an HTML page.");
  const html = new TextDecoder().decode(await boundedResponse(res, 1_500_000));
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
  if (!headings.length && paragraphs.length < 2) throw new Error("This page does not expose enough readable content (it may need JavaScript or sign-in). Import a screenshot of the page instead.");
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
    "STACK CHOICE: HTML + CSS + JavaScript",
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
    .join("\n").slice(0, 7800);
}

/** Fetch index.html (or public/index.html, dist/index.html) from a public GitHub repo. */
export async function fetchGithubIndex(repoUrl: string): Promise<{ html: string; path: string; repo: string }> {
  const m = repoUrl.match(/github\.com\/([\w.-]+)\/([\w.-]+)(?:\/tree\/([\w.\-/]+))?/i);
  if (!m) throw new Error("Enter a GitHub repository URL like https://github.com/owner/repo");
  const owner = m[1];
  const repo = m[2].replace(/\.git$/, "");
  const ref = m[3] ?? "HEAD";
  if ([owner, repo, ref].some((s) => s.split("/").some((seg) => !seg || seg === ".." || seg === "."))) throw new Error("Invalid repository URL.");
  const candidates = ["index.html", "public/index.html", "dist/index.html", "docs/index.html", "src/index.html"];
  for (const p of candidates) {
    const url = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${ref.split("/").map(encodeURIComponent).join("/")}/${p}`;
    const res = await fetchPublic(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    if (res.ok) {
      const html = await res.text();
      if (/<html[\s>]/i.test(html)) return { html, path: p, repo: `${owner}/${repo}` };
    }
  }
  throw new Error("No index.html found in the repository (checked root, public/, dist/, docs/, src/). Import a static site or use URL import for the deployed page.");
}

/**
 * Normalise a project file path: absolute, no traversal, no backslashes, safe characters only.
 * Returns null when the path cannot be made safe (zip-slip, hidden system paths…).
 */
export function safeProjectPath(p: string): string | null {
  const parts = p.replace(/\\/g, "/").split("/").filter((s) => s && s !== ".");
  if (parts.some((s) => s === ".." || !/^[\w\-.+@()[\]]+$/.test(s))) return null;
  const out = "/" + parts.join("/");
  return out.length > 1 && out.length <= 200 ? out : null;
}


export async function boundedResponse(response: Response, limit: number): Promise<ArrayBuffer> {
  if (Number(response.headers.get("content-length")) > limit) throw new Error("Import exceeds the allowed size.");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The source returned no content.");
  const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > limit) throw new Error("Import exceeds the allowed size."); chunks.push(value); } }
  finally { await reader.cancel().catch(() => {}); }
  const data = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  return data.buffer;
}

/** Import the complete source archive, never just GitHub's HTML entry point. */
export async function fetchGithubArchive(repoUrl: string) {
  const url = new URL(repoUrl);
  if (url.protocol !== "https:" || url.hostname !== "github.com" || url.username || url.password) throw new Error("Use https://github.com/owner/repository or its /tree/branch URL.");
  const parts = url.pathname.split("/").filter(Boolean);
  const [owner, rawRepo] = parts; const repo = rawRepo?.replace(/\.git$/, "");
  if (!owner || !repo || !/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo) || (parts.length > 2 && (parts[2] !== "tree" || parts.length < 4))) throw new Error("Enter a repository or branch URL, not an individual file.");
  const ref = parts.length > 2 ? parts.slice(3).join("/") : "HEAD";
  const response = await fetchPublic(`https://api.github.com/repos/${owner}/${repo}/zipball/${encodeURIComponent(ref)}`, { headers: { "User-Agent": UA, Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(response.status === 404 ? "Repository or branch not found. Use a public repository, or upload a ZIP of your private project." : `GitHub import failed (${response.status}). Try again or upload a ZIP.`);
  return { ...await readZip(await boundedResponse(response, 25 * 1024 * 1024)), repo: `${owner}/${repo}` };
}

const IGNORED = /(^|\/)(node_modules|\.git|\.next|__MACOSX|vendor|target|\.venv)(\/|$)|(^|\/)(\.DS_Store|\.env(?:\..*)?|[^/]*\.(?:pem|key))$/i;
const BINARY = /\.(png|jpe?g|gif|webp|ico|avif|woff2?|ttf|otf|pdf|mp4|webm|mp3|wav)$/i;
const TEXT = /\.(html?|css|scss|sass|less|[cm]?[jt]sx?|json|map|md|txt|svg|xml|ya?ml|toml|ini|conf|sql|prisma|py|java|kt|kts|go|rs|php|rb|cs|fs|swift|dart|vue|svelte|sh|bat|ps1|gradle|properties|lock|mod|sum|c|cpp|h|hpp|ex|exs|erl|hrl|clj|scala|r|lua|pl|hs|elm|graphql|gql|proto|csproj|sln)$/i;
export async function readZip(buf: ArrayBuffer): Promise<{ html: string | null; files: { path: string; content: string }[]; stack: string; warnings: string[] }> {
  if (buf.byteLength > 25 * 1024 * 1024) throw new Error("ZIP is too large (max 25 MB).");
  const zip = await JSZip.loadAsync(buf).catch(() => { throw new Error("This is not a readable ZIP archive."); });
  const entries = Object.values(zip.files).filter(f => !f.dir);
  if (entries.length > 5000) throw new Error("Too many archive entries. Remove dependencies and build caches first.");
  const candidates = entries.filter(f => !IGNORED.test(f.name) || /(^|\/)\.env\.example$/.test(f.name));
  const root = candidates[0]?.name.split("/")[0];
  const stripRoot = root && !["src", "app", "public", "pages", "lib"].includes(root) && candidates.every(f => f.name.startsWith(root + "/")) ? root + "/" : "";
  const files: { path: string; content: string }[] = []; const warnings: string[] = []; let total = 0;
  for (const entry of candidates) {
    const original = (entry as typeof entry & { unsafeOriginalName?: string }).unsafeOriginalName ?? entry.name;
    if (original.split(/[\\/]/).includes("..") || original.startsWith("/")) throw new Error("ZIP contains an unsafe file path.");
    const name = entry.name.slice(stripRoot.length);
    const path = safeProjectPath(name);
    if (!path) throw new Error(`Unsupported file path: ${name.slice(0, 100)}`);
    if (!BINARY.test(name) && !TEXT.test(name) && !/(^|\/)(Dockerfile|Makefile|Gemfile|Procfile|LICENSE|\.[\w.-]+)$/.test(name)) { warnings.push(`Skipped unsupported file: ${name}`); continue; }
    if (files.length >= 200) throw new Error("Project exceeds 200 source/assets files. Remove unused files first.");
    const data = await new Promise<Buffer>((resolve, reject) => {
      const stream = entry.nodeStream() as Readable; const chunks: Buffer[] = []; let size = 0;
      stream.on("data", chunk => { size += chunk.length; if (size > 500_000 || total + size > 2_000_000) { const error = new Error("Project exceeds 2 MB of extracted files or 500 KB per file."); reject(error); stream.destroy(error); } else chunks.push(chunk); });
      stream.on("error", reject); stream.on("end", () => resolve(Buffer.concat(chunks)));
    });
    total += data.length;
    if (files.some(f => f.path === path)) throw new Error("ZIP contains duplicate file paths.");
    files.push({ path, content: BINARY.test(name) ? BINARY_PREFIX + data.toString("base64") : new TextDecoder("utf-8", { fatal: true }).decode(data) });
  }
  if (!files.length) throw new Error("No supported project files were found.");
  const pkg = files.find(f => f.path === "/package.json");
  const native = Boolean(pkg || files.some(f => /\.(tsx?|jsx|vue|svelte|py|java|go|rs|php|cs|swift|kt|dart)$/.test(f.path)));
  const stack = pkg ? (/"next"\s*:/.test(pkg.content) ? "Next.js + TypeScript" : /"react"\s*:/.test(pkg.content) ? "React + TypeScript" : "Imported JavaScript project") : native ? "Imported source project" : "HTML + CSS + JavaScript";
  const index = files.find(f => f.path === "/index.html") ?? files.find(f => /\/index\.html$/.test(f.path));
  // Keep framework entry points as source; they need their own build/runtime.
  const html = index && !native ? inlineStaticHtml(index.content, index.path, files) : null;
  if ((html?.length ?? 0) + files.reduce((n, f) => n + f.content.length, 0) > 2_000_000) throw new Error("Project exceeds the 2 MB editable-source limit after preparing assets.");
  return { html, files, stack, warnings: [...(entries.length !== candidates.length ? ["Dependencies, caches and private environment/key files were excluded."] : []), ...warnings].slice(0, 20) };
}
function inlineStaticHtml(html: string, index: string, files: { path: string; content: string }[]) {
  const find = (url: string, base = index) => files.find(f => f.path === posix.resolve(posix.dirname(base), url.split(/[?#]/)[0]));
  const mime = (path: string) => ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", svg: "image/svg+xml", webp: "image/webp", gif: "image/gif", woff: "font/woff", woff2: "font/woff2", ico: "image/x-icon" }[path.split(".").pop()!] ?? "application/octet-stream");
  const asset = (url: string, base?: string) => { const file = find(url, base); return file ? `data:${mime(file.path)};base64,${fileBytes(file.content).toString("base64")}` : url; };
  const css = (text: string, base: string) => text.replace(/url\(\s*["']?([^"')]+)["']?\s*\)/g, (_, url) => `url("${asset(url, base)}")`);
  return html.replace(/<link\b[^>]*>/gi, tag => { const href = tag.match(/href=["']([^"']+)["']/i)?.[1]; const file = href && find(href); return file && /\.css$/.test(file.path) ? `<style>${css(file.content, file.path).replace(/<\/style/gi, "<\\/style")}</style>` : tag; })
    .replace(/<script\b([^>]*)src=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (tag, a, url, b) => { const file = find(url); return file ? `<script ${a}${b}>${file.content.replace(/<\/script/gi, "<\\/script")}</script>` : tag; })
    .replace(/(<(?:img|source)\b[^>]*\bsrc=)["']([^"']+)["']/gi, (_, prefix, url) => `${prefix}"${asset(url)}"`);
}
