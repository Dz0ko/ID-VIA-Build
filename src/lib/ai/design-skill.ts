/**
 * "UI/UX Pro Max": the design intelligence every builder/designer agent applies,
 * plus a library of 21st.dev-class hero sections and motion rules
 * (Motion One for static HTML sites, framer-motion for React apps).
 */

export const UI_UX_PRO_MAX = `DESIGN INTELLIGENCE (UI/UX Pro Max). Apply on every build and edit:
1. Pick ONE style and commit to it (never mix): Minimal Luxury (lots of air, 1 accent, serif display) · Dark Signal (near-black, one electric accent, glass cards) · Glassmorphism (blurred translucent panels over gradients) · Bento (rounded tiles grid, mixed sizes) · Neo-Brutalist (thick borders, offset shadows, raw type) · Editorial (big serif, columns, rules) · Soft SaaS (pastel gradients, rounded-2xl, friendly). Choose by the user’s audience and brand; preserve an established visual language during edits. Do not default every project to dark gradients or bento cards.
2. Colour system: 1 neutral scale (9 steps), 1 accent, 1 accent-soft, semantic success/warning/error. Body text contrast ≥ 4.5:1, large text ≥ 3:1. Never pure #000 on white or pure white on black; use #0a0a0b / #f5f5f7. Gradients only as background or one hero element, never on body text.
3. Typography: one display face + one text face (+ mono for labels). Pairings that work: Space Grotesk+Inter, Manrope+Inter, Sora+DM Sans, Playfair Display+Inter, Instrument Serif+Geist, Bricolage Grotesque+Inter. Scale: 12/14/16/18/20/24/32/40/56/72px; line-height 1.1 for display, 1.5–1.6 for body; letter-spacing −0.02em on headlines. Max 65ch line length.
4. Spacing & layout: 4px base; section padding 96–128px desktop / 64px mobile; container 1200–1280px; radius consistent (choose 12/16/24); shadows layered and soft (0 1px 2px + 0 12px 40px rgba). Grid: 12 cols desktop, 4 mobile. Use labels only when they improve hierarchy; every section has one clear purpose.
5. Hierarchy & CTA: one primary CTA per view (filled, accent), one secondary (outline/ghost). Buttons ≥ 44px tall, hover lifts −1px + shadow, focus-visible ring 2px accent. Headline states the outcome, subline states how, CTA states the action ("Start free", not "Submit").
6. UX rules: mobile nav with a working toggle and Escape to close; sticky header with blur; skip-link; visible focus states; forms with labels, inline validation and success state; empty/loading/error states in apps; touch targets 44px; no text in images; alt text; prefers-reduced-motion respected; no autoplaying sound; lazy-load below-the-fold images; consistent icon set (inline SVG, 1.5px stroke).
7. Anti-patterns to avoid: centered walls of text, more than 2 fonts, rainbow gradients, carousels for key content, tiny 12px body text, default blue links in UI, uneven card heights in a grid, 6+ CTAs, lorem ipsum, stock "team" photos with fake names.
8. Content: specific, benefit-led copy with numbers where truthful; social proof only if provided by the user, otherwise use product facts (features, guarantees) not invented customers.`;

export const HERO_LIBRARY = `HERO SECTION LIBRARY (21st.dev class; choose the one that fits, implement it fully, adapt colours):
H1 Spotlight: full-bleed dark hero, radial spotlight following the cursor (CSS var --x/--y updated on mousemove), giant headline with word-by-word reveal, two CTAs, trust line of 3 product facts.
H2 Aurora / Animated gradient: slow-moving multi-stop gradient blobs (3 blurred divs, 20–30s ease-in-out keyframes, mix-blend-mode screen) behind glass panel with headline + email capture.
H3 Split with floating product cards: left copy (label, headline, subline, CTAs), right 3D-tilting mock cards (perspective 1200px, rotate on mousemove, float keyframes, staggered delays) showing real product UI fragments.
H4 Bento hero: headline top-left, 5–7 bento tiles (varying col/row spans) with live micro-content (stat counter, mini chart via inline SVG, avatar stack, toggle), hover scale 1.02 and border glow.
H5 Text-first Minimal: huge serif headline (clamp(40px, 8vw, 96px)), thin rule, one line subcopy, single CTA, generous whitespace, subtle grain overlay (SVG feTurbulence at 6% opacity).
H6 Product screenshot with glow: headline, then a browser-frame mockup (top bar with 3 dots) containing the product image, tilted 6° with perspective, glowing accent shadow, scroll-linked untilt (IntersectionObserver / useScroll).
H7 Marquee + logos: hero with infinite horizontal marquee of feature chips or client logos (duplicated track, translateX −50%, pause on hover), headline above, CTA below.
H8 Video / shader background: looping muted video or animated SVG noise/wave shader (feTurbulence + feDisplacementMap) behind a dark overlay; keep text on a solid or blurred panel for contrast.
H9 Command-palette / terminal hero (dev tools): headline + an animated terminal card typing real commands with a blinking cursor and coloured output lines.
H10 Pricing-led hero (SaaS): headline + segmented monthly/annual toggle + 3 plan cards directly in the hero with the middle card elevated.
Choose supporting sections to fit the actual product; do not force a marquee, logos or invented statistics into every site. Every hero must be responsive (stack on <768px, hide 3D on touch) and respect prefers-reduced-motion.`;

export const MOTION_RULES_HTML = `MOTION (static HTML sites): use Motion One from CDN for premium animation (same author as framer-motion), plus CSS for micro-interactions.
Load once before </body>:
<script type="module">
import { animate, inView, stagger, scroll } from "https://cdn.jsdelivr.net/npm/motion@11.11.17/+esm";
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (!reduce) {
  inView("[data-reveal]", ({ target }) => { animate(target, { opacity: [0, 1], y: [24, 0] }, { duration: 0.7, easing: [0.22, 1, 0.36, 1] }); }, { margin: "-10% 0px" });
  inView(".stagger", ({ target }) => { animate(target.children, { opacity: [0, 1], y: [16, 0] }, { delay: stagger(0.08), duration: 0.6 }); });
  document.querySelectorAll("[data-count]").forEach((el) => inView(el, () => { const to = Number(el.dataset.count); animate((p) => (el.textContent = Math.round(to * p).toLocaleString()), { duration: 1.4, easing: "ease-out" }); }));
  scroll(animate(".hero-art", { y: [0, -60] }), { target: document.querySelector(".hero"), offset: ["start start", "end start"] });
}
</script>
Rules: reveal-on-scroll for sections (data-reveal), stagger for grids (.stagger), count-up for stats (data-count), parallax only on the hero art, hover/focus transitions via CSS (transition 200–300ms, ease-out), never animate layout-affecting properties (width/height), only transform/opacity. Add "opacity:0" initial only via JS-added class so content stays visible without JS.`;

export const MOTION_RULES_APP = `MOTION (React apps): use framer-motion (installed). Patterns:
- Page/section reveal: <motion.section initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-10%" }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
- Lists/grids: parent variants { hidden: {}, show: { transition: { staggerChildren: 0.08 } } } and child { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }.
- Hover/tap: whileHover={{ y: -2, scale: 1.01 }} whileTap={{ scale: 0.98 }} on cards and buttons.
- Presence: wrap modals, toasts, tab panels in <AnimatePresence mode="wait"> with exit animations; use layoutId for shared-element transitions (tabs underline, selected card).
- Scroll: useScroll + useTransform for hero parallax and progress bars; useInView for counters.
- Respect useReducedMotion(): when true, set transition duration 0 and disable parallax.
Put reusable motion primitives in /components/motion.tsx (Reveal, Stagger, Counter, TiltCard) and use them everywhere instead of ad-hoc animations.`;

export const DESIGN_ACCEPTANCE = `DESIGN ACCEPTANCE — apply to both new builds and targeted edits:
- Make an opinionated, cohesive composition based on the actual brand and content. Give the page a strong focal point, intentional typography, consistent alignment and a restrained color system. Avoid generic card grids and decorative effects without a purpose.
- When asked for a navbar, deliver a complete responsive navigation: balanced logo/link/action groups, clear active state, readable contrast over every underlying section, deliberate spacing, and a compact mobile menu with a real button, aria-expanded and aria-controls. Support keyboard navigation, Escape, focus return and closing after selection. Dropdowns must work on touch and keyboard, not hover alone. Use focus trapping only for a modal drawer, and restore scroll locking when it closes.
- Every visible CTA and navigation item must have a meaningful destination or action within the generated project. No fake purchase success, dead href="#" links, invented customer endorsements, or platform-specific links.
- Check the implementation against narrow mobile (360px), tablet and desktop layouts: no overflow, clipped labels, overlapping fixed headers or inaccessible dropdowns. Use scroll-margin-top for anchored sections beneath sticky navigation.
- On a targeted request (such as a modern navbar), improve that component while preserving the rest of the site, its content and working behavior. Match its design tokens; do not rebuild the entire product.
- Keep first paint readable without animation, honor reduced motion, and limit expensive blur, canvas and scroll handlers. Do not add a heavy library just for a simple interaction.
- Before returning code, inspect your output for missing closing tags/files, unresolved imports, duplicate IDs, broken mobile toggles and missing error states. You cannot execute tests or inspect a browser in this generation call: never claim those checks ran. Return complete code in the required format, plus a brief honest completion note.`;

/** Everything a builder agent needs, in one block. */
export function designSkill(mode: "html" | "app") {
  return [UI_UX_PRO_MAX, DESIGN_ACCEPTANCE, HERO_LIBRARY, mode === "html" ? MOTION_RULES_HTML : MOTION_RULES_APP].join("\n\n");
}
