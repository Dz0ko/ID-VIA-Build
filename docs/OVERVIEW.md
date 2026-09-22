# IDÆVIA Build — Project Overview

Live at **https://idaevia.app** · Repo `Dz0ko/ID-VIA-Build` · Updated 22 September 2026

IDÆVIA Build is an AI software-creation platform. A user describes a website or app in one sentence; a team of 30 named specialist agents plans, designs, builds, tests and deploys it, while the user watches the site stream in, edits real code, collects client approvals and launches, all from one workspace (web app and desktop app).

---

## 1. Product at a glance

| Area | What the user gets |
|---|---|
| Build | Single-file websites (HTML + Tailwind + vanilla JS) or multi-file React + TypeScript apps, generated and edited by chat |
| Agents | 30 specialists with professions, hand-off messages and first-person completion notes; auto-routing picks the right one |
| Models | Five tiers: Haiku 4.5 → Sonnet 5 → Sonnet 5 high → Opus 5 / GPT-5.6 Sol → Fable 5.1 / GPT-6 Astra, user-selectable per run |
| Workspace | Live preview (desktop/tablet/mobile), Monaco code editor, in-browser React sandbox, versions & rollback, audits, logs |
| Terminal | Real server-side commands: `publish`, `git push`, `deploy vercel`, `supabase link`, `env set`, `audit`, `export` |
| Integrations | GitHub (OAuth or token), Vercel, Supabase, Higgsfield, Netlify; encrypted at rest |
| Library | 27 templates (19 categories incl. 7 interactive mini-apps), prompt library, components & effects with live previews |
| Collaboration | Teams, white-label client portal with comments/approvals, share links with password & expiry |
| Marketplace | Sell websites, components, prompts and agents; buyers get a preview, sellers keep 90%, payouts to crypto/PayPal |
| Growth | Referral links (free credits), affiliate programme (% commission), Learn academy (18 lessons, glossary) |
| Billing | Whop as payment processor: 4 monthly plans, 4 credit packs, card/PayPal/crypto; credits with a guaranteed margin floor |
| Admin | Overview, users, payments, payout requests, affiliates, marketplace moderation, model & pricing settings |
| Apps | Web app (idaevia.app) and Tauri desktop app (macOS/Windows) with a real local shell |

---

## 2. Who it is for

- **Founders**: idea → live product without an agency. Plans, builds, deploys, keeps the code.
- **Agencies**: client sites in hours; portal with approvals, white-label, versions; sell templates on the marketplace.
- **Creators**: templates, interactive mini-apps (quizzes, polls, countdowns), one-sentence remixes.
- **Developers**: real Vite project export, `git push`, `deploy vercel`, Supabase, env vars, terminal.

The product is desktop-first (web on a computer or the desktop app). Phones and tablets see the landing page and can create an account, then continue on desktop.

---

## 3. The workspace

### 3.1 Creating a project
- From a prompt, from a template (27), from a screenshot/reference image (Starter+), from a URL, GitHub repo or ZIP import.
- Kinds: `website` (one HTML document) or `app` (React + TS files rendered in a Sandpack sandbox).

### 3.2 Chat with the team
- The user writes a request. **Auto-routing** classifies it (tiny / small / section / page / feature / full-stack) and picks the specialist; the user can also pick an agent and a model tier explicitly.
- The chosen agent posts a hand-off message ("Designer picking this up. I'll …"), streams the work, then posts a first-person completion note ("Copy pass done in v07 …"). Chat bubbles show *Name · profession*.
- One-click workflows run whole teams: Build website, Make it premium, Production ready, Optimise landing.

### 3.3 Preview, code, versions
- Live preview with device switcher; sandboxed iframe (no access to the app or cookies).
- Monaco editor for HTML or every file of an app; save creates a version.
- Versions tab: every agent run is a version with a message; restore any version.
- Problems tab: production audit (performance, SEO, accessibility, security, code, mobile) with one-click fixes by the Debugger.
- Logs tab: routing decisions, model, credits, publish/deploy events.

### 3.4 Terminal (real)
| Command | Effect |
|---|---|
| `status`, `ls`, `cat <file>` | project state, deployable file tree |
| `preview`, `audit` | validity check, audit scores |
| `publish` / `unpublish` | idaevia.app hosting at `/s/<slug>` (Free plan adds a "Made with IDÆVIA" badge) |
| `git push [owner/repo] [--public]` | creates the repo if needed, uploads every file as one commit (Git Data API) |
| `deploy vercel [name]` | static or Vite deployment, streams build state and logs, sets env vars on the project |
| `env set KEY=VALUE`, `env list`, `env unset` | encrypted per-project env; `VITE_*` baked into builds |
| `supabase link` | injects the connected Supabase project's URL and keys |
| `export` | ZIP of the site or the full Vite project |
| desktop app only | any shell command (npm, git, node) in a real local shell |

### 3.5 Share & client portal
- Share links per project with optional password and expiry; permissions: comment, approve.
- Portal page (no account needed): live preview, comments, change requests, approval status; white-label branding per team (name, logo, accent, welcome text, hide IDÆVIA).

### 3.6 Teams
- Agency plan: teams with roles (owner/admin/editor/viewer), attach projects, shared white-label settings.

---

## 4. The 30 agents

| Group | Agents (profession) |
|---|---|
| Core | Builder (lead full-stack engineer), Planner (product planner), Designer (product designer), Copywriter (conversion copywriter), Debugger (debugging engineer), SEO (technical SEO specialist) |
| Design & content | UI (UI engineer), UX (UX researcher), Animation (motion designer), 3D (3D & WebGL artist), Asset (visual asset producer), Localization (localisation specialist), Reference (reference analyst), Clone (reconstruction engineer) |
| Quality | Performance, Accessibility, Security, QA, Refactoring, Dependency auditor |
| Full-stack & launch | Database architect, API engineer, Auth engineer, Payments engineer, Git (release engineer), Deploy (DevOps), Analytics, Conversion (CRO), Documentation (technical writer), PM (project manager) |

Every agent's system prompt carries an identity block (works and speaks as that specialist, never names the underlying model), the **UI/UX Pro Max** design intelligence (style systems, colour/type/spacing rules, UX checklist, anti-patterns), a **hero-section library** (10 patterns in the 21st.dev style) and **motion rules** (Motion One for HTML sites, framer-motion for React apps). Agents unlock by plan (Free: first 4, Starter: 8, Pro: 20, Max: all, Agency: all + custom agents).

Custom agents (Agency): name, description, system prompt, tier, mode; can be shared publicly (prompt stays private) or sold on the marketplace.

---

## 5. Models and routing

| Tier | Default model | Alternative (user-selectable) | Multiplier |
|---|---|---|---|
| Fast | Claude Haiku 4.5 | GPT-5.6 Luna (fallback) | ×1 |
| Standard | Claude Sonnet 5 | GPT-5.6 Terra | ×1.5 |
| Advanced | Claude Sonnet 5 · high effort | GPT-5.6 Terra | ×3 |
| Premium | Claude Opus 5 | GPT-5.6 Sol | ×6 |
| Frontier | Claude Fable 5.1 | GPT-6 Astra | ×12 |

- Auto-routing never escalates to Frontier; it is always a deliberate user choice.
- Automatic provider fallback: if Anthropic rejects for account/capacity reasons, the same tier runs on OpenAI; failures are refunded with a friendly message.
- Prompt caching on the system prompt; effort capped by task size; output capped to what the task can need.

---

## 6. Credits and pricing

### Plans (monthly, via Whop)
| Plan | Price | Credits | Agents | Top tier | Notes |
|---|---|---|---|---|---|
| Free | $0 | 100 | 4 | Standard | 3 projects, IDÆVIA badge on published sites |
| Starter | $19 | 750 | 8 | Standard | export, vision, publish without badge, Learn |
| Pro | $49 | 2,500 | 20 | Advanced | 25% rollover, priority |
| Max | $99 | 6,000 | all 30 | Frontier | 25% rollover |
| Agency | $489 (list $652, save 25%) | 15,000 | all + custom | Frontier | teams, white-label, client portal |

### Credit packs (one-time, paid plans)
500 for $12 · 1,500 for $33 · 4,000 for $80 · 10,000 for $180. Purchased credits never expire and are spent after plan credits.

### How a run is priced
- Class price: base (tiny 2, small 3, section 5, page 10, feature 20, full-stack 40) × agent multiplier × tier multiplier.
- **Profit floor**: at least `estimated provider cost × credits-per-dollar` where credits-per-dollar is 150 (fast/standard), 165 (advanced), 210 (premium), 260 (frontier). Estimates include the document size (rewrites re-emit the whole document) and reasoning tokens.
- A hold (×1.2 to ×1.6) is reserved during the run and released to the exact final charge; failed runs are refunded, malformed output refunds half.
- Result: no plan or pack can go below ~50% gross margin even in the worst case; typical 65–85%.
- Every charge appears in the user's **Credit usage** log with the reason (agent, task, model tier, document size, tokens generated, refunds).

### Referrals & affiliates
- Every user has `/r/<code>`: friend gets 50 credits, referrer gets 50 (capped at 10 rewarded signups / 30 days) and 300 when the friend goes paid.
- Admin-managed affiliates earn a % of every payment by their referred users; attribution cookie 30 days, only on real navigation.

---

## 7. Marketplace

- Listing types: website/app templates, components, prompts, agents. Publishing requires Starter+.
- Buyers see a script-stripped, watermarked preview (never the code); after purchase they can **install** the item into a new project.
- Payment: Whop one-time checkout (card, PayPal, crypto). Platform fee 10%; seller balance credited on `payment.succeeded`, reversed on refund/dispute.
- **Seller wallet** (profile): available / pending / paid-out, payout destination (crypto: USDT/USDC/BTC/ETH networks, or PayPal), "Request payout" (min $10). Admin approves after sending the money or rejects with a reason; every step is logged.

---

## 8. Templates, components, effects, prompts, Learn

- **Templates**: 20 business templates (SaaS, Agency, Startup, Portfolio, Restaurant, Hotel, Real estate, Fitness, Healthcare, Legal, Automotive, Events, Education, E-commerce, Creator, Finance, Web3, Gaming, AI) generated from a config engine, plus 7 **Interactive** hand-written mini-apps (trivia quiz, poll, event countdown + RSVP + calendar, decision wheel, personality quiz, would-you-rather, party cards).
- **Components & Effects**: library with live previews (hover, scroll, cursor, 3D) insertable by prompt.
- **Prompts**: curated prompt library per category.
- **Learn** (Starter+): 18 step-by-step lessons (frontend, backend, languages, design, UI/UX, Git/GitHub, Supabase, hosting, APIs, credits, first website/app, SEO, security, smart contracts) and a 45-term glossary.

---

## 9. Integrations

| Provider | How | Used for |
|---|---|---|
| GitHub | one-click OAuth (repo scope) or fine-grained token | `git push` |
| Vercel | personal token (+ optional team id) | `deploy vercel` |
| Supabase | project URL + anon key (+ service key) | `supabase link`, Database agent |
| Higgsfield | API key (+ secret) | injected as `HIGGSFIELD_API_KEY` for generated apps |
| Netlify | personal token | alternative static hosting |

Credentials are verified against the provider on save, stored AES-256-GCM encrypted, never shown again, never sent to AI providers.

---

## 10. Accounts, security, legal

- Sign-in: email + password (bcrypt), Google, GitHub. OAuth never links into a password account by email. Password change revokes other sessions.
- Sessions: signed httpOnly cookies (30 days, versioned). CSRF origin guard on all mutating API routes. DB-backed atomic rate limits (login, signup, runs, checkout, payouts, terminal, portal passwords).
- User HTML is always rendered in an opaque-origin sandbox (CSP `sandbox`), previews cannot touch the app.
- Hardened: SSRF guard on URL import, zip-slip protection, open-redirect guard, webhook HMAC + replay protection + amount verification, atomic credit accounting, admin bounds.
- Legal pages: Privacy Policy, Terms of Service, Cookie Policy; cookie notice; consent line on signup; robots.txt and sitemap.
- Analytics: Whop pixel (`page`, `view_content`, `complete_registration`, `login`, `purchase_return`).

---

## 11. Admin (`/admin`)

Overview (users, plans, MRR, runs, costs, margins), Users (plan/role/credits), Payments (memberships, Whop events), Payouts (payout requests with crypto/PayPal details, sales, seller wallets, affiliates), Affiliates (create links, commission %), Marketplace (moderate listings, purchases), Settings (models per tier, effort, multipliers, credit bases, credits-per-dollar and per-tier margin floors, referral rewards).

---

## 12. Technology

Next.js 16 (App Router) · React 19 · Tailwind v4 · Prisma 6 on Supabase Postgres · Vercel (fra1, cron) · Anthropic SDK (adaptive thinking, server-side fallback for Fable) · OpenAI SDK · Whop API + webhooks · Tauri desktop shell · Sandpack for React apps · Monaco editor.

Operational needs: `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` with credit, `WHOP_API_KEY`/`WHOP_COMPANY_ID`/`WHOP_WEBHOOK_SECRET`, Google/GitHub OAuth, `AUTH_SECRET`, `CRON_SECRET`, `INTEGRATIONS_KEY` (optional), `APP_URL`.
