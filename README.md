# IDÆVIA Build

**AI Software Creation Platform — Build anything. Ship everything.**

Web app + desktop app (Tauri) that lets anyone create websites, landing pages and apps from a prompt, a template, or both — with a team of 30 AI agents, multi-model routing, credits, Whop subscriptions, versions, audits, publishing and export.

## Stack

| Layer | Choice |
|---|---|
| Frontend / API | Next.js 16 (App Router), React 19, TypeScript, Tailwind v4 |
| Database | Prisma 6 on Supabase Postgres (pooler for runtime, direct URL for schema pushes) |
| Auth | Email + password (JWT cookie), Google and GitHub OAuth |
| Billing | **Whop** — checkout links, membership webhooks (Standard Webhooks HMAC), credit packs |
| AI | Multi-provider router: Anthropic (Claude), OpenAI, offline mock engine. Tiers (fast / standard / advanced / premium) are mapped to concrete models in the admin panel |
| Editor | Monaco |
| Desktop | Tauri 2 (`src-tauri/`) |

## Quick start

```bash
npm install
cp .env.example .env        # then edit .env
npm run setup               # prisma generate + db push (to Supabase) + seed admin
npm run dev                 # http://localhost:3737
```

Default admin (from `.env`): `admin@idaevia.app` / `admin12345` — plan AGENCY, role ADMIN → `/admin`.

Without any AI key the platform runs in **offline mode**: generation uses a deterministic template engine so every feature (builder, agents, versions, audit, deploy, export) still works. Add `ANTHROPIC_API_KEY` (and/or `OPENAI_API_KEY`) to `.env` for real AI.

## Environment

See `.env.example`. Key values:

- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` — AI providers.
- `AI_TIER_FAST` / `AI_TIER_STANDARD` / `AI_TIER_ADVANCED` / `AI_TIER_PREMIUM` / `AI_TIER_FRONTIER` — override the Anthropic model per tier (defaults: `claude-haiku-4-5`, `claude-sonnet-5`, `claude-sonnet-5`, `claude-opus-5`, `claude-fable-5-1`). The frontier tier (Max and Agency, opt-in) can also be pointed at OpenAI's `gpt-6-astra` from Admin → Model tiers. When a tier falls back to OpenAI it uses `gpt-5.6-luna` / `gpt-5.6-terra` / `gpt-5.6-sol` / `gpt-6-astra`; `OPENAI_MODEL` overrides all of them.
- Growth: admins create **affiliate links** (`/r/<code>`) with a commission percentage in Admin → Affiliates; every plan payment by a user who signed up through the link records a commission (owed / mark paid). Every user also has a **referral link** on their profile: the friend gets bonus credits on signup, the referrer gets credits on signup and again when the friend buys a plan (amounts editable in Admin → Referral rewards).
- Credit costs and tier multipliers are editable in Admin → Settings; the defaults and the margin analysis live in the "Credit Economics & Plan Margins" doc in Tempo.
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — "Continue with Google" on /login. Authorized redirect URI: `${APP_URL}/api/auth/google/callback`.
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` — "Continue with GitHub". Callback URL: `${APP_URL}/api/auth/github/callback`.
- Whop is the payment processor only (no Whop login). Nothing is created in the Whop dashboard by hand.
- `WHOP_API_KEY` + `WHOP_COMPANY_ID` — every plan, credit pack and marketplace order is created on the fly with `POST /api/v1/checkout_configurations` (inline plan; products are upserted by `external_identifier`, e.g. `idaevia-plan-pro`, `idaevia-pack-1500`, `idaevia-market-<item>`). Our user id and what was bought travel in `metadata` (`idaevia_user_id`, `idaevia_plan`, `credits`, `purchase_id`).
- `WHOP_WEBHOOK_SECRET` — webhook endpoint: `${APP_URL}/api/webhooks/whop` (events: `membership.activated`, `membership.deactivated`, `payment.succeeded`). Memberships set the plan and grant the plan's credits; `payment.succeeded` grants pack credits, settles marketplace orders (90% to the seller, 10% platform fee) and pays affiliate commissions.
- Legacy fallback (optional): `WHOP_CHECKOUT_*` static checkout links + `WHOP_PLAN_MAP` (Whop plan id → `STARTER | PRO | MAX | AGENCY`).
- Without Whop keys, local dev shows a plan switcher and simulates marketplace payments.

When Whop is **not** configured, Settings shows a dev plan switcher so you can test every plan locally.

## Structure

```
src/app/                 pages + route handlers
  (landing) page.tsx     /            marketing site
  pricing/               /pricing
  login, signup/         auth
  app/                   dashboard, projects, templates, prompts, agents, components, effects, deployments, settings
  app/projects/[id]/     the workspace (explorer · preview/code · AI team · chat/changes/terminal/logs/problems)
  admin/                 model tiers, credit economics, users
  s/[slug]/              IDÆVIA hosting (published sites)
  api/                   auth, projects, run (SSE), publish, export, versions, audit, billing, webhooks, admin
src/lib/
  agents.ts              30-agent registry + agent teams + plan gating
  plans.ts               FREE / STARTER / PRO / MAX / AGENCY
  ai/router.ts           task classifier → tier → model (clamped by plan)
  ai/provider.ts         Anthropic / OpenAI / mock providers (streaming)
  ai/generate.ts         run an agent: reserve credits → generate → save version → log
  credits.ts             credit estimation, reserve, refund, grant
  settings.ts            admin-editable model tiers & credit economics (no redeploy)
  whop.ts                OAuth URLs, webhook signature verification, plan map
  audit.ts               deterministic production audit (performance/SEO/a11y/security/code/mobile)
  templates/             template engine + 20 templates
  library.ts             prompt library, prompt packs, effects, components
prisma/schema.prisma     data model
src-tauri/               desktop shell
public/brand/            brand kit
```

## Desktop app (Tauri 2)

```bash
npm run tauri dev      # opens the desktop shell against the local dev server
npm run tauri build    # installers (Windows: MSVC Build Tools + WebView2 required)
```

The production desktop build loads `https://idaevia.app` (set in `src-tauri/tauri.conf.json`).

## Scripts

`dev`, `build`, `start`, `lint`, `typecheck`, `db:push`, `db:seed`, `setup`, `tauri`.

## Deploy to Vercel (idaevia.app)

1. Push `main` to GitHub. Import the repo in Vercel (framework: Next.js, root: repo root).
2. Add every variable from `.env.example` under Settings → Environment Variables. `DATABASE_URL`/`DIRECT_URL` must be the Supabase Postgres URLs; Vercel has no disk, SQLite does not work there.
3. The build runs `vercel-build`: `prisma generate && prisma db push && next build`, so the schema is applied to Supabase on every deploy.
4. Seed the admin once from your machine with the production `.env`: `npm run db:seed`.
5. Domains: add `idaevia.app` and `www.idaevia.app` in Vercel; at GoDaddy set `A @ → 76.76.21.21` and `CNAME www → cname.vercel-dns.com`. SSL is automatic (`.app` requires HTTPS).
6. After the first deploy set the OAuth redirect URIs and the Whop webhook to `https://idaevia.app/...`.

## Production notes

- Set a strong `AUTH_SECRET`, `APP_URL` to the public URL.
- Generated sites are single-file HTML served from the database — no arbitrary server-side code execution.
