/**
 * Deterministic single-file website renderer.
 * Used for (1) the template library and (2) the offline mock AI provider.
 */

export interface Palette {
  bg: string;
  surface: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  border: string;
}

export interface SiteConfig {
  id: string;
  name: string;
  category: string;
  description: string;
  brand: string;
  tagline: string;
  subline: string;
  ctaPrimary: string;
  ctaSecondary: string;
  nav: string[];
  palette: Palette;
  fontDisplay: string;
  fontBody: string;
  heroImageSeed: string;
  features: { title: string; text: string }[];
  stats?: { value: string; label: string }[];
  pricing?: { name: string; price: string; period: string; items: string[]; featured?: boolean }[];
  testimonials?: { quote: string; name: string; role: string }[];
  faq?: { q: string; a: string }[];
  gallery?: boolean;
  contact?: boolean;
  lang?: string;
  dark?: boolean;
  /** Hand-written document (interactive mini-apps); when set, renderSite is skipped. */
  html?: string;
}

export const PALETTES: Record<string, Palette> = {
  dark: { bg: "#0a0a0b", surface: "#121214", text: "#f5f5f7", muted: "#8a8a93", accent: "#5b5cff", accentText: "#ffffff", border: "#1c1c1f" },
  midnight: { bg: "#0b1020", surface: "#111834", text: "#eef2ff", muted: "#94a3b8", accent: "#7c8cff", accentText: "#ffffff", border: "#1e2a4a" },
  emerald: { bg: "#06110d", surface: "#0d1f17", text: "#ecfdf5", muted: "#86a394", accent: "#34d399", accentText: "#04140d", border: "#163427" },
  light: { bg: "#ffffff", surface: "#f6f6f8", text: "#111114", muted: "#6b6b75", accent: "#3b3ce0", accentText: "#ffffff", border: "#e6e6ea" },
  warm: { bg: "#fffaf3", surface: "#fff2e2", text: "#2a1d12", muted: "#8a7461", accent: "#d9772b", accentText: "#ffffff", border: "#f0dfc8" },
  rose: { bg: "#fff7f8", surface: "#ffeef1", text: "#2b1418", muted: "#8f6b72", accent: "#e0447a", accentText: "#ffffff", border: "#f5d5dc" },
  ocean: { bg: "#f3f9fb", surface: "#e6f2f6", text: "#0d2430", muted: "#5c7a86", accent: "#0e7c9b", accentText: "#ffffff", border: "#cfe3ea" },
  sand: { bg: "#faf7f0", surface: "#f2ecdd", text: "#26221a", muted: "#7d7360", accent: "#b08a3e", accentText: "#ffffff", border: "#e6dcc3" },
  purple: { bg: "#09060f", surface: "#130d1f", text: "#f4efff", muted: "#9d93b3", accent: "#a855f7", accentText: "#ffffff", border: "#241a38" },
  slate: { bg: "#f8fafc", surface: "#eef2f7", text: "#0f172a", muted: "#64748b", accent: "#0f172a", accentText: "#ffffff", border: "#dbe2ea" },
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const icons = [
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12h8M12 8v8"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m9 12 2 2 4-4"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="9"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14"/><path d="M4 19h16M9 8h6M9 12h6"/></svg>`,
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2a5 5 0 0 1 5 5v3H7V7a5 5 0 0 1 5-5z"/><rect x="5" y="10" width="14" height="11" rx="2"/></svg>`,
];

export function renderSite(c: SiteConfig): string {
  const p = c.palette;
  const lang = c.lang ?? "en";
  const fontsParam = [c.fontDisplay, c.fontBody]
    .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`)
    .join("&");
  const navLinks = c.nav
    .map((n) => `<a href="#${n.toLowerCase().replace(/\s+/g, "-")}" class="hover:opacity-70 transition">${esc(n)}</a>`)
    .join("");
  const features = c.features
    .map(
      (f, i) => `
        <div class="reveal card p-6 rounded-2xl border" style="background:${p.surface};border-color:${p.border}">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style="background:${p.accent}22;color:${p.accent}">${icons[i % icons.length]}</div>
          <h3 class="text-lg font-semibold mb-2">${esc(f.title)}</h3>
          <p style="color:${p.muted}">${esc(f.text)}</p>
        </div>`,
    )
    .join("");
  const stats = c.stats
    ? `<section class="py-12 border-y" style="border-color:${p.border}"><div class="max-w-6xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">${c.stats
        .map(
          (s) => `<div class="reveal"><div class="text-4xl font-semibold tracking-tight" style="color:${p.accent}">${esc(s.value)}</div><div class="mt-1 text-sm" style="color:${p.muted}">${esc(s.label)}</div></div>`,
        )
        .join("")}</div></section>`
    : "";
  const pricing = c.pricing
    ? `<section id="pricing" class="py-24"><div class="max-w-6xl mx-auto px-6">
        <div class="text-center max-w-2xl mx-auto mb-14 reveal"><p class="text-sm font-mono uppercase tracking-[0.2em]" style="color:${p.accent}">Pricing</p><h2 class="mt-3 text-4xl font-semibold tracking-tight">Simple, transparent plans</h2></div>
        <div class="grid md:grid-cols-${Math.min(c.pricing.length, 3)} gap-6">${c.pricing
          .map(
            (t) => `<div class="reveal rounded-2xl border p-8 flex flex-col ${t.featured ? "ring-2" : ""}" style="background:${p.surface};border-color:${t.featured ? p.accent : p.border};--tw-ring-color:${p.accent}">
              <div class="text-sm font-medium" style="color:${p.muted}">${esc(t.name)}</div>
              <div class="mt-3 flex items-baseline gap-1"><span class="text-4xl font-semibold tracking-tight">${esc(t.price)}</span><span class="text-sm" style="color:${p.muted}">${esc(t.period)}</span></div>
              <ul class="mt-6 space-y-3 text-sm flex-1">${t.items.map((i) => `<li class="flex gap-2"><span style="color:${p.accent}">✓</span><span>${esc(i)}</span></li>`).join("")}</ul>
              <a href="#contact" class="mt-8 inline-flex justify-center rounded-full px-5 py-3 text-sm font-medium transition hover:opacity-90" style="background:${t.featured ? p.accent : p.text};color:${t.featured ? p.accentText : p.bg}">${esc(c.ctaPrimary)}</a>
            </div>`,
          )
          .join("")}</div></div></section>`
    : "";
  const testimonials = c.testimonials
    ? `<section id="testimonials" class="py-24" style="background:${p.surface}"><div class="max-w-6xl mx-auto px-6">
        <div class="text-center mb-14 reveal"><p class="text-sm font-mono uppercase tracking-[0.2em]" style="color:${p.accent}">Testimonials</p><h2 class="mt-3 text-4xl font-semibold tracking-tight">Loved by customers</h2></div>
        <div class="grid md:grid-cols-3 gap-6">${c.testimonials
          .map(
            (t) => `<figure class="reveal rounded-2xl border p-6" style="background:${p.bg};border-color:${p.border}"><blockquote class="text-base leading-relaxed">“${esc(t.quote)}”</blockquote><figcaption class="mt-5 flex items-center gap-3"><img loading="lazy" alt="" width="40" height="40" class="w-10 h-10 rounded-full object-cover" src="https://picsum.photos/seed/${encodeURIComponent(t.name)}/80/80"><div><div class="text-sm font-semibold">${esc(t.name)}</div><div class="text-xs" style="color:${p.muted}">${esc(t.role)}</div></div></figcaption></figure>`,
          )
          .join("")}</div></div></section>`
    : "";
  const faq = c.faq
    ? `<section id="faq" class="py-24"><div class="max-w-3xl mx-auto px-6">
        <div class="text-center mb-12 reveal"><p class="text-sm font-mono uppercase tracking-[0.2em]" style="color:${p.accent}">FAQ</p><h2 class="mt-3 text-4xl font-semibold tracking-tight">Questions, answered</h2></div>
        <div class="divide-y" style="border-color:${p.border}">${c.faq
          .map(
            (f) => `<details class="reveal group py-5" style="border-color:${p.border}"><summary class="flex cursor-pointer items-center justify-between font-medium list-none">${esc(f.q)}<span class="ml-4 transition group-open:rotate-45" style="color:${p.accent}">+</span></summary><p class="mt-3 text-sm leading-relaxed" style="color:${p.muted}">${esc(f.a)}</p></details>`,
          )
          .join("")}</div></div></section>`
    : "";
  const gallery = c.gallery
    ? `<section id="gallery" class="py-24"><div class="max-w-6xl mx-auto px-6"><div class="text-center mb-12 reveal"><p class="text-sm font-mono uppercase tracking-[0.2em]" style="color:${p.accent}">Gallery</p><h2 class="mt-3 text-4xl font-semibold tracking-tight">A closer look</h2></div><div class="grid grid-cols-2 md:grid-cols-4 gap-4">${[1, 2, 3, 4, 5, 6, 7, 8]
        .map(
          (i) => `<img loading="lazy" alt="${esc(c.brand)} gallery ${i}" class="reveal rounded-xl object-cover w-full aspect-square hover:scale-[1.02] transition" src="https://picsum.photos/seed/${c.heroImageSeed}${i}/600/600">`,
        )
        .join("")}</div></div></section>`
    : "";
  const contact = c.contact !== false
    ? `<section id="contact" class="py-24" style="background:${p.surface}"><div class="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
        <div class="reveal"><p class="text-sm font-mono uppercase tracking-[0.2em]" style="color:${p.accent}">Contact</p><h2 class="mt-3 text-4xl font-semibold tracking-tight">Let’s talk</h2><p class="mt-4" style="color:${p.muted}">Tell us about your project and we’ll get back within one business day.</p></div>
        <form class="reveal rounded-2xl border p-6 space-y-4" style="background:${p.bg};border-color:${p.border}" onsubmit="event.preventDefault();this.querySelector('button').textContent='Sent ✓'">
          <label class="block text-sm"><span class="mb-1 block" style="color:${p.muted}">Name</span><input required class="w-full rounded-lg border px-3 py-2 bg-transparent" style="border-color:${p.border}" placeholder="Your name"></label>
          <label class="block text-sm"><span class="mb-1 block" style="color:${p.muted}">Email</span><input required type="email" class="w-full rounded-lg border px-3 py-2 bg-transparent" style="border-color:${p.border}" placeholder="you@company.com"></label>
          <label class="block text-sm"><span class="mb-1 block" style="color:${p.muted}">Message</span><textarea required rows="4" class="w-full rounded-lg border px-3 py-2 bg-transparent" style="border-color:${p.border}" placeholder="How can we help?"></textarea></label>
          <button class="w-full rounded-full px-5 py-3 text-sm font-medium transition hover:opacity-90" style="background:${p.accent};color:${p.accentText}">Send message</button>
        </form></div></section>`
    : "";

  return `<!DOCTYPE html>
<html lang="${lang}" class="scroll-smooth">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(c.brand)} | ${esc(c.tagline)}</title>
<meta name="description" content="${esc(c.subline)}">
<meta property="og:title" content="${esc(c.brand)} | ${esc(c.tagline)}">
<meta property="og:description" content="${esc(c.subline)}">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?${fontsParam}&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<style>
  :root{--bg:${p.bg};--surface:${p.surface};--text:${p.text};--muted:${p.muted};--accent:${p.accent};--border:${p.border}}
  body{background:var(--bg);color:var(--text);font-family:'${c.fontBody}',system-ui,sans-serif}
  h1,h2,h3,.display{font-family:'${c.fontDisplay}','${c.fontBody}',sans-serif}
  .reveal{opacity:0;transform:translateY(18px);transition:opacity .7s ease,transform .7s ease}
  .reveal.in{opacity:1;transform:none}
  @media (prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}}
  .glow{box-shadow:0 0 0 1px ${p.accent}33, 0 30px 80px -20px ${p.accent}55}
  .grad{background:radial-gradient(60% 60% at 50% 0%, ${p.accent}33 0%, transparent 70%)}
</style>
</head>
<body>
<a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 px-3 py-1 rounded bg-black text-white">Skip to content</a>
<header class="sticky top-0 z-40 backdrop-blur border-b" style="background:${p.bg}cc;border-color:${p.border}">
  <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
    <a href="#" class="flex items-center gap-2 font-semibold tracking-tight"><span class="w-7 h-7 rounded-lg inline-flex items-center justify-center text-sm font-bold" style="background:${p.accent};color:${p.accentText}">${esc(c.brand.slice(0, 1))}</span>${esc(c.brand)}</a>
    <nav class="hidden md:flex items-center gap-8 text-sm">${navLinks}</nav>
    <div class="hidden md:flex items-center gap-3"><a href="#contact" class="text-sm hover:opacity-70">${esc(c.ctaSecondary)}</a><a href="#contact" class="rounded-full px-4 py-2 text-sm font-medium transition hover:opacity-90" style="background:${p.accent};color:${p.accentText}">${esc(c.ctaPrimary)}</a></div>
    <button id="menuBtn" aria-label="Open menu" aria-expanded="false" class="md:hidden w-10 h-10 inline-flex items-center justify-center rounded-lg border" style="border-color:${p.border}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>
  </div>
  <nav id="mobileNav" class="md:hidden hidden border-t px-6 py-4 flex flex-col gap-4 text-sm" style="border-color:${p.border};background:${p.bg}">${navLinks}<a href="#contact" class="rounded-full px-4 py-2 text-center font-medium" style="background:${p.accent};color:${p.accentText}">${esc(c.ctaPrimary)}</a></nav>
</header>

<main id="main">
<section class="relative overflow-hidden grad">
  <div class="max-w-6xl mx-auto px-6 pt-24 pb-20 grid lg:grid-cols-2 gap-12 items-center">
    <div class="reveal in">
      <span class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-mono uppercase tracking-[0.18em]" style="border-color:${p.border};color:${p.muted}"><span class="w-1.5 h-1.5 rounded-full" style="background:${p.accent}"></span>${esc(c.category)}</span>
      <h1 class="mt-6 text-5xl md:text-6xl font-semibold tracking-tight leading-[1.02]">${esc(c.tagline)}</h1>
      <p class="mt-6 text-lg max-w-xl" style="color:${p.muted}">${esc(c.subline)}</p>
      <div class="mt-8 flex flex-wrap gap-3">
        <a href="#contact" class="rounded-full px-6 py-3 font-medium transition hover:opacity-90 glow" style="background:${p.accent};color:${p.accentText}">${esc(c.ctaPrimary)}</a>
        <a href="#features" class="rounded-full px-6 py-3 font-medium border transition hover:opacity-80" style="border-color:${p.border}">${esc(c.ctaSecondary)}</a>
      </div>
    </div>
    <div class="reveal in relative">
      <div class="absolute -inset-6 rounded-[2rem] blur-3xl opacity-40" style="background:${p.accent}"></div>
      <img alt="${esc(c.brand)}" width="1200" height="900" class="relative rounded-2xl border object-cover w-full aspect-[4/3]" style="border-color:${p.border}" src="https://picsum.photos/seed/${c.heroImageSeed}/1200/900">
    </div>
  </div>
</section>

${stats}

<section id="features" class="py-24">
  <div class="max-w-6xl mx-auto px-6">
    <div class="max-w-2xl mb-14 reveal"><p class="text-sm font-mono uppercase tracking-[0.2em]" style="color:${p.accent}">Why ${esc(c.brand)}</p><h2 class="mt-3 text-4xl font-semibold tracking-tight">Everything you need, nothing you don’t</h2></div>
    <div class="grid md:grid-cols-3 gap-6">${features}</div>
  </div>
</section>

${gallery}
${pricing}
${testimonials}
${faq}
${contact}
</main>

<footer class="border-t py-10" style="border-color:${p.border}">
  <div class="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm" style="color:${p.muted}">
    <div>© <span id="year"></span> ${esc(c.brand)}. All rights reserved.</div>
    <div class="flex gap-6">${c.nav.map((n) => `<a href="#${n.toLowerCase().replace(/\s+/g, "-")}" class="hover:opacity-70">${esc(n)}</a>`).join("")}</div>
  </div>
</footer>

<script>
  document.getElementById('year').textContent = new Date().getFullYear();
  const btn = document.getElementById('menuBtn'), nav = document.getElementById('mobileNav');
  btn.addEventListener('click', () => { const open = nav.classList.toggle('hidden'); btn.setAttribute('aria-expanded', String(!open)); });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.add('hidden')));
  const io = new IntersectionObserver((es) => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(el => io.observe(el));
</script>
</body>
</html>`;
}
