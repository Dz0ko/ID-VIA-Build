import { websiteBrief, saasBrief, SAAS_BRIEFS } from "./prompt-briefs";
/** Prompt library, prompt packs and effects library (static content). */

export interface PromptItem {
  id: string;
  category: string;
  title: string;
  prompt: string;
}

const WEBSITE_PROMPTS: PromptItem[] = [
  { id: "saas-crm", category: "SaaS", title: "AI CRM landing", prompt: "Build a modern dark SaaS landing page for an AI CRM targeting agencies. Premium black and purple style, smooth scroll animations, features grid, pricing with 3 tiers, testimonials, FAQ and a dashboard preview section." },
  { id: "saas-analytics", category: "SaaS", title: "Analytics platform", prompt: "Create a light, clean landing page for a product analytics platform: hero with product screenshot, 6 features, logos row, pricing (Free/Growth/Scale), testimonials and FAQ." },
  { id: "saas-pm", category: "SaaS", title: "Project management tool", prompt: "Build a landing page for a project management tool for remote teams. Friendly, colourful, with feature sections alternating image/text, integrations grid and a CTA banner." },
  { id: "agency", category: "Agency", title: "Design agency", prompt: "Create a bold, minimal website for a design agency called Northform: big typographic hero, selected work grid, services, team, testimonials and a contact form." },
  { id: "startup", category: "Startup", title: "Waitlist launch", prompt: "Build a launch page with a waitlist form for a startup called Orbit that summarises meetings with AI. Dark midnight palette, three benefits, FAQ." },
  { id: "portfolio", category: "Portfolio", title: "Designer portfolio", prompt: "Create a minimal personal portfolio for a product designer: intro, selected projects grid with hover, about section, services and contact." },
  { id: "restaurant", category: "Restaurant", title: "Restaurant", prompt: "Build a warm website for a Mediterranean restaurant called Casa Lumen: hero, menu highlights, gallery, chef story, reservations form, opening hours and map placeholder." },
  { id: "hotel", category: "Hotel", title: "Boutique hotel", prompt: "Create an elegant boutique hotel website: rooms with prices, amenities, gallery, reviews and a booking CTA. Ocean blue palette, serif headings." },
  { id: "realestate", category: "Real Estate", title: "Real estate agency", prompt: "Build a real estate agency website with featured listings cards (price, beds, area), why-us stats, agents section and a viewing request form." },
  { id: "fitness", category: "Fitness", title: "Gym / trainer", prompt: "Create an energetic gym website called FORGE: programs, class schedule table, pricing, trainer bios, transformation testimonials, trial CTA. Dark green accent." },
  { id: "medical", category: "Medical", title: "Clinic", prompt: "Build a calm, trustworthy clinic website: services, doctors, insurance logos, stats, FAQ and an appointment form." },
  { id: "legal", category: "Legal", title: "Law firm", prompt: "Create a professional law firm website: practice areas, partners, case results, testimonials, consultation form. Slate palette with serif headings." },
  { id: "automotive", category: "Automotive", title: "Car service", prompt: "Build a car service website: services with prices, booking form, guarantees, before/after gallery, location and hours." },
  { id: "events", category: "Events", title: "Conference", prompt: "Create a conference landing page: dates and venue, speakers grid, schedule tabs, ticket tiers, sponsors and FAQ. Purple neon style." },
  { id: "education", category: "Education", title: "Online course", prompt: "Build an online course sales page: outcome-driven hero, curriculum accordion, instructor bio, student results, pricing and money-back guarantee." },
  { id: "ecommerce", category: "E-commerce", title: "Fashion store", prompt: "Create a fashion store landing: seasonal hero, product grid with prices and hover, brand values, reviews, newsletter signup." },
  { id: "creator", category: "Creator", title: "Link in bio", prompt: "Build a creator link-in-bio page: avatar, bio, link buttons with icons, latest videos, membership tiers." },
  { id: "web3", category: "Web3", title: "Token landing", prompt: "Create a Web3 protocol landing page: hero with animated gradient, TVL stats, features, tokenomics chart placeholder, roadmap, FAQ." },
  { id: "dashboard", category: "SaaS", title: "Admin dashboard UI", prompt: "Build an admin dashboard UI (not a landing page): sidebar navigation, top bar, KPI cards, a line chart placeholder, recent orders table and activity feed. Dark theme." },
  { id: "local-salon", category: "Local", title: "Local business", prompt: "Build a modern website for a hair salon: services with prices, gallery, team, appointment booking, opening hours and contact." },
];

export const PROMPT_LIBRARY: PromptItem[] = [
  ...WEBSITE_PROMPTS.map(item => ({ ...item, category: item.id === "dashboard" ? "SaaS applications" : ["saas-crm", "saas-analytics", "saas-pm", "startup", "web3"].includes(item.id) ? "Landing pages" : "Websites", prompt: item.id === "dashboard" ? saasBrief("operations dashboard", "teams managing customer orders", "Provide a workspace overview with KPIs derived from saved orders, customer management, searchable and sortable order lists, order details, activity history and role-aware settings. Include creation, editing, filtering and export flows. Do not fabricate live charts or totals.", "workspaces, members, customers, orders, order items and audit events") : websiteBrief(item.title, item.prompt) })),
  ...SAAS_BRIEFS.map(item => ({ id: item.id, category: "SaaS applications", title: item.title, prompt: saasBrief(item.title, item.audience, item.flows, item.data) })),
];

export interface PromptPack {
  id: string;
  name: string;
  description: string;
  steps: { title: string; prompt: string; agent?: string }[];
}

export const PROMPT_PACKS: PromptPack[] = [
  {
    id: "saas-launch",
    name: "SaaS Launch Pack",
    description: "A complete launch brief covering strategy, design, copy, SEO and verification.",
    steps: [
      { title: "Product strategy", prompt: "Define the target customer, central problem, primary conversion and three concrete value propositions. Identify assumptions and use a coherent brand voice throughout.", agent: "planner" },
      { title: "Landing page", prompt: "Build a responsive SaaS landing page with outcome-led hero, real product walkthrough, feature details, transparent pricing, clearly labelled sample social proof and useful FAQ. Connect CTAs to onboarding or a validated contact flow." },
      { title: "Copy pass", prompt: "Replace generic claims with specific benefits, concise headlines and clear action labels. Keep pricing and limitations honest; do not invent customer results.", agent: "copywriter" },
      { title: "Design polish", prompt: "Create a consistent type and spacing scale, responsive navbar with working mobile menu, purposeful visual hierarchy, accessible contrast and restrained motion with reduced-motion support.", agent: "designer" },
      { title: "SEO", prompt: "Add unique titles, descriptions, social previews and meaningful image alt text. Use structured data only for verified facts and ensure semantic page landmarks.", agent: "seo" },
      { title: "Production check", prompt: "Verify navigation, forms, keyboard operation, loading and error states at mobile/tablet/desktop widths. Fix broken flows, run the available checks and report remaining integration requirements.", agent: "debugger" },
    ],
  },
  {
    id: "local-business",
    name: "Local Business Pack",
    description: "Website for a local business with booking, SEO and translation.",
    steps: [
      { title: "Site", prompt: "Build a local business website with a clear service-area hero, service detail pages, honest pricing, gallery, about section, opening hours and a validated booking enquiry. Do not display a confirmed booking unless it is saved by a real backend." },
      { title: "Local SEO", prompt: "Add unique page metadata and a contact section with editable address, opening hours, phone and an optional map. Generate LocalBusiness structured data only from supplied factual business details.", agent: "seo" },
      { title: "Translate", prompt: "Translate all visitor-facing copy, form errors, menus and metadata to natural Macedonian. Preserve brand names and use appropriate date and number formatting.", agent: "localization" },
      { title: "Mobile", prompt: "Check widths from 390px to desktop, mobile navigation, form validation, keyboard focus and image loading. Provide accessible touch targets and report what was actually tested.", agent: "debugger" },
    ],
  },
];

export interface EffectItem {
  id: string;
  group: "Hover" | "Scroll" | "Cursor" | "Background";
  name: string;
  description: string;
  /** Prompt sent to the Builder to add the effect. */
  prompt: string;
}

export const EFFECTS: EffectItem[] = [
  { id: "magnetic", group: "Hover", name: "Magnetic button", description: "Buttons subtly follow the cursor.", prompt: "Add a magnetic hover effect to all primary buttons (translate towards the cursor within 12px, spring back on leave)." },
  { id: "glow", group: "Hover", name: "Glow", description: "Soft accent glow on hover.", prompt: "Add a soft accent-coloured glow (box-shadow) on hover to cards and primary buttons." },
  { id: "tilt", group: "Hover", name: "3D tilt", description: "Cards tilt in 3D toward the cursor.", prompt: "Add a 3D tilt hover effect to feature and pricing cards using perspective and rotateX/rotateY based on mouse position." },
  { id: "border-anim", group: "Hover", name: "Animated border", description: "Gradient border that rotates on hover.", prompt: "Add an animated conic-gradient border on hover to the featured pricing card." },
  { id: "image-zoom", group: "Hover", name: "Image zoom", description: "Images scale slightly on hover.", prompt: "Add a smooth zoom on hover to all images inside cards and the gallery." },
  { id: "text-reveal", group: "Scroll", name: "Text reveal", description: "Headline words reveal one by one.", prompt: "Animate the hero headline with a word-by-word reveal on load (opacity + translateY, staggered)." },
  { id: "fade", group: "Scroll", name: "Fade in", description: "Sections fade in as they enter.", prompt: "Add fade-in on scroll to every section using IntersectionObserver; respect prefers-reduced-motion." },
  { id: "parallax", group: "Scroll", name: "Parallax", description: "Hero image moves slower than scroll.", prompt: "Add a subtle parallax effect to the hero image on scroll." },
  { id: "sticky", group: "Scroll", name: "Sticky sections", description: "Feature blocks pin while scrolling.", prompt: "Make the features section a sticky-scroll showcase: left text pins while images change on the right." },
  { id: "progress", group: "Scroll", name: "Scroll progress bar", description: "Thin bar at the top shows progress.", prompt: "Add a thin accent-coloured scroll progress bar fixed to the top of the page." },
  { id: "cursor", group: "Cursor", name: "Custom cursor", description: "Dot + ring cursor.", prompt: "Add a custom cursor (small dot plus a lagging ring) that enlarges over links and buttons; hide on touch devices." },
  { id: "cursor-glow", group: "Cursor", name: "Cursor glow", description: "Spotlight follows the cursor.", prompt: "Add a soft radial spotlight that follows the cursor over the hero section." },
  { id: "gradient", group: "Background", name: "Animated gradient", description: "Slowly shifting mesh gradient.", prompt: "Add a slowly animating mesh/aurora gradient background behind the hero." },
  { id: "grid", group: "Background", name: "Grid + noise", description: "Subtle grid with film grain.", prompt: "Add a subtle grid pattern and a noise overlay to the page background." },
  { id: "particles", group: "Background", name: "Particles", description: "Floating dots with lines.", prompt: "Add a lightweight canvas particle network behind the hero (dots connected by faint lines), paused when off-screen." },
  { id: "three-sphere", group: "Background", name: "3D glass sphere", description: "Three.js floating sphere.", prompt: "Add a Three.js floating glass-like sphere with soft lighting to the hero that reacts to mouse movement. Load three.js from cdnjs. Fall back gracefully without WebGL." },
];

export const COMPONENTS: { id: string; name: string; prompt: string }[] = [
  { id: "navbar", name: "Navbar", prompt: "Add a sticky, blurred navbar with logo, links and a primary CTA, plus a working mobile menu." },
  { id: "hero", name: "Hero", prompt: "Add a premium hero section with headline, subline, two CTAs and a product visual." },
  { id: "logos", name: "Logo cloud", prompt: "Add a 'trusted by' logo row with 6 monochrome placeholder logos and an infinite marquee." },
  { id: "features", name: "Features grid", prompt: "Add a 3x2 features grid with icons, titles and descriptions." },
  { id: "pricing", name: "Pricing", prompt: "Add a 3-tier pricing section with a monthly/yearly toggle and a highlighted plan." },
  { id: "testimonials", name: "Testimonials", prompt: "Add a testimonials section with 3 cards, avatars and ratings." },
  { id: "faq", name: "FAQ", prompt: "Add an FAQ accordion with 6 questions." },
  { id: "cta", name: "CTA banner", prompt: "Add a full-width CTA banner with a gradient background before the footer." },
  { id: "contact", name: "Contact form", prompt: "Add a contact section with a form (name, email, message) and company details." },
  { id: "footer", name: "Footer", prompt: "Add a 4-column footer with links, newsletter input and social icons." },
  { id: "stats", name: "Stats", prompt: "Add a stats row with 4 animated counters." },
  { id: "table", name: "Data table", prompt: "Add a responsive data table with sortable headers and status pills." },
  { id: "login", name: "Login form", prompt: "Add a centred login card with email/password, social buttons and links." },
  { id: "modal", name: "Modal", prompt: "Add a modal dialog opened by a button, with focus trap and escape to close." },
];
