# The Logo Professionals — CLAUDE.md

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript strict
- **Styling:** Vanilla CSS — single `globals.css` for tokens + one scoped `.css` file per component. No Tailwind, no CSS-in-JS.
- **Fonts:** Playfair Display (headings) + Inter (body) via `next/font/google`
- **Content storage:** JSON files in `src/content/` (team + posts) committed to git
- **Database:** Firestore (Firebase Admin SDK) — payment orders + rate-limit buckets only
- **Auth:** Firebase Auth (Google sign-in) → JWT cookie (`jose`) — admin only
- **Payments:** Stripe (`stripe` server-side) — Checkout Sessions, hosted by Stripe
- **Bot protection:** Google reCAPTCHA v3 (invisible) verified server-side
- **Contact form:** EmailJS (`@emailjs/browser`) + reCAPTCHA on the form widget
- **Package manager:** npm

## Folder Structure

```
src/
  app/                                ← Next.js App Router (thin shells)
    layout.tsx                        ← Root: fonts only, no NavBar/Footer
    globals.css                       ← Design tokens + base styles + wizard token bridge
    robots.ts                         ← /admin and /api disallowed
    sitemap.ts                        ← Builds from team.json + posts.json
    (public)/                         ← Route group: wraps NavBar + Footer
      layout.tsx                      ← Reads team.json, passes to NavBar
      page.tsx                        ← / → <HomePage />
      our-work/page.tsx               ← /our-work → <OurClientsPage />
      about-us/
        page.tsx                      ← /about-us → <AboutPage />
        [slug]/page.tsx               ← /about-us/<slug> → <TeamMemberPage />
      blog/
        page.tsx                      ← /blog list (published only)
        [slug]/page.tsx               ← /blog/<slug>
      portfolio/
        [slug]/page.tsx               ← /portfolio/<slug>
      contact-us/page.tsx             ← /contact-us → <ContactPage />
    services/                         ← Route group: NavBar only, no Footer
      layout.tsx
      page.tsx                        ← /services → <LogoConfigurator /> wizard
      success/page.tsx                ← Stripe success redirect
      cancel/page.tsx                 ← Stripe cancel redirect
    admin/                            ← 404 in production via proxy.ts
      layout.tsx                      ← Sidebar shell, dev-only links
      page.tsx                        ← Dashboard
      login/page.tsx                  ← Google sign-in
      orders/page.tsx, [id]/page.tsx  ← Read Firestore orders
      posts/page.tsx, new, [id], PostForm, DeletePostBtn
      team/page.tsx, new, [id], TeamForm, DeleteTeamMemberBtn
      AdminSidebar.tsx
    api/
      create-checkout/route.ts        ← Stripe Checkout (rate-limited, reCAPTCHA-verified, server-priced)
      stripe-webhook/route.ts         ← Marks orders paid (idempotent)
      admin-auth/route.ts             ← Login: verifies Firebase ID token → JWT cookie
      admin-check/route.ts            ← Cookie check for NavBar admin link
      posts/route.ts, [id]/route.ts   ← Local-only: write to posts.json
      team/route.ts, [id]/route.ts    ← Local-only: write to team.json
      upload/route.ts                 ← Local-only: write images to /public

  components/
    ui/                               ← Atoms (Button, Input, AutoplayVideo)
    sections/                         ← Site sections (NavBar, Footer, Hero, FAQ, Stats, Testimonials, ClientLogos, PortfolioGrid)

  featured/                           ← Full-page components rendered by routes
    HomePage, AboutPage, OurClientsPage, ContactPage
    TeamMemberPage                    ← Parallax profile page
    PortfolioItemPage                 ← Project detail
    OrderSuccessPage, OrderCancelPage

  wizard/                             ← /services multi-step configurator
    sections/                         ← Each screen (Service, Brand, Variations, Style, Typography, Colors, Summary, + Website* equivalents)
    ui/                               ← Wizard-scoped atoms
    websitePricing.ts                 ← Website-only price helpers
    tokens.ts, types.ts, utils.ts

  content/                            ← Source of truth for blog/portfolio/team
    posts.json                        ← Blog + portfolio entries
    team.json                         ← Team members

  lib/
    content.ts                        ← Read/write JSON content (writes blocked in prod)
    data.ts                           ← Static lists: testimonials, clientLogos, stats, faq
    pricing.ts                        ← Server-side price computation
    orderValidation.ts                ← Sanitizer for /api/create-checkout body
    rateLimit.ts                      ← Firestore-backed IP + email limiter
    emailjs.ts                        ← Contact-form EmailJS helper
    recaptcha-client.ts               ← Loads grecaptcha + executes
    recaptcha-server.ts               ← Verifies token via siteverify API
    firebase/
      admin.ts                        ← Lazy Admin SDK proxy (Firestore + Auth)
      index.ts                        ← Client SDK (Auth only — Firestore endpoint denied by rules)
    auth/
      requireAdmin.ts                 ← Cookie + JWT + email whitelist
      sessionSecret.ts                ← Throws if ADMIN_SESSION_SECRET unset/short

  proxy.ts                            ← Next.js 16 middleware (renamed). Gates /admin in prod, auth for admin in dev.
```

## Design Tokens (`src/app/globals.css`)

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#1B1815` | Page background |
| `--surface` | `#231F1B` | Section background |
| `--card` | `#2C2824` | Card background |
| `--border` | `#0D0A08` | Border |
| `--primary-green` | `#58B9A5` | Primary brand accent (teal) |
| `--primary-green-light` | `#7ECABB` | Hover / lift |
| `--primary-green-dim` | `#3D9B88` | Muted accent |
| `--primary-rose` | `#E3688B` | Secondary brand accent (pastel pink) |
| `--primary-rose-light` | `#EA8BA5` | Hover / lift |
| `--primary-rose-dim` | `#C4506F` | Muted accent |
| `--text` | `#ffffff` | Primary text |
| `--text-secondary` | `#dadada` | Body text |
| `--text-muted` | `#8f8f8f` | Eyebrow / label |
| `--text-faint` | derived | Even quieter |
| `--success` `--error` `--warning` `--info` | — | Status colors (`--success` uses `#58B9A5`) |
| `--line` `--line-strong` | derived from `--text` | Hairlines |

The wizard maps its `--color-*` tokens to these via a `.lc-root` block in `globals.css`.

## Environment Variables

`.env.local` (never commit). Mirror the required ones in Vercel → Environment Variables.

```
# Admin sessions — REQUIRED (no fallback). 32+ chars. openssl rand -base64 48
ADMIN_SESSION_SECRET=

# Firebase Admin SDK — REQUIRED in production (orders + rate-limit)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Firebase client SDK — used for Google sign-in only
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Stripe — REQUIRED
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# reCAPTCHA v3 — REQUIRED in production (fail-open in dev)
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
RECAPTCHA_SECRET_KEY=

# EmailJS — for /contact-us form
NEXT_PUBLIC_EMAILJS_SERVICE_ID=
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=

# Optional — override the canonical URL used in Stripe redirects
NEXT_PUBLIC_SITE_URL=https://thelogoprofessionals.com
```

## Commands

```bash
npm run dev      # localhost:3000
npm run build    # production build
npm run start    # serve production build
npm run lint     # ESLint
```

## Content System

Blog posts, portfolio items, and team members live as JSON in `src/content/`. Edits go through the local admin UI and end up as git-committed file changes.

- **`src/content/posts.json`** — `Post[]` from `lib/content.ts`. Each has `type: "blog" | "portfolio"`, `published: boolean`, optional `teamMember: <slug>` to attribute to a designer.
- **`src/content/team.json`** — `TeamMember[]` with hero/profile images, bio, quote, social links, display order.
- Images go to `/public/<folder>/` where folder is `blog`, `portfolio`, `team`, or `uploads`. Random UUID filenames.

### How to publish content
1. `npm run dev` locally
2. Sign in at `/admin/login` (Google account must be in the admin whitelist)
3. Create / edit posts at `/admin/posts`, team members at `/admin/team`
4. Save → JSON file in `src/content/` is updated, uploaded images land in `/public/`
5. `git add -A && git commit -m "..." && git push`
6. Vercel rebuilds; new content is live as static pages

## Admin System

- **Whitelist:** `igor.dolovski@gmail.com`, `nikodola@gmail.com` (hardcoded in `proxy.ts`, `requireAdmin.ts`, `admin-auth/route.ts`)
- **Auth:** Google sign-in via Firebase Auth → server verifies ID token → issues HS256 JWT in `admin_session` cookie (HttpOnly, Secure, sameSite=lax, 7d)
- **Production:** `/admin/*` and `/api/admin-*` + `/api/posts` + `/api/team` + `/api/upload` are **404** via `proxy.ts`. Admin only works in `npm run dev`.
- **In dev:** Cookie auth required; admin email enforced at every layer (proxy + route handlers).

## Payment Flow

1. User opens `/services` → multi-step wizard (logo design, logo redesign, or website)
2. Client computes a price estimate for UI display only
3. Submit → POST `/api/create-checkout` with full payload + reCAPTCHA token
4. Server runs **in this order**:
   1. **reCAPTCHA verification** — siteverify API, action=`checkout`, score >= 0.5
   2. **Input sanitization** — strips unknown fields, caps strings/arrays
   3. **Rate limiting** — Firestore-backed, 5/IP and 3/email per 15 min (HTTP 429 on trip)
   4. **Server-side pricing** — recomputes from validated inputs via `lib/pricing.ts`. Client-supplied `amount` is ignored.
   5. **Stripe session** — uses canonical site URL for redirects (never the `Origin` header in prod)
   6. **Firestore write** — `orders` collection, status `"pending"`
5. Browser redirects to Stripe-hosted checkout
6. On payment success: Stripe → `/api/stripe-webhook` → idempotent update of order to `status: "paid"`
7. Customer redirected to `/services/success?session_id=...` or `/services/cancel`

### Pricing (see `lib/pricing.ts`)

**Logo / Redesign:** base $150 + ($25 per extra variation beyond first) + custom typography (capped at $500) − coupon
**Website:** base $400 (corporate) or $640 (ecommerce) + ($80 per non-free page) + optional domain ($40) / hosting ($240) / maintenance ($300) − coupon
**Deposit:** 35% of total, rounded to nearest $5
**Coupons:** `ANETA SH` ($84 off logos), `ANETACH` ($200 off websites) — server validates code matches before applying

## Security Model

| Layer | Mechanism |
|---|---|
| Admin auth | HS256 JWT (pinned algorithm) in HttpOnly cookie + email whitelist + `ADMIN_SESSION_SECRET` (required, no fallback) |
| Admin in prod | All `/admin/*` and admin APIs return 404 — handled by `proxy.ts` |
| Content writes | `lib/content.ts` throws on writes when `NODE_ENV === "production"` |
| File uploads | Folder whitelist + MIME whitelist + size caps (10MB images, 50MB video) + path-resolve check |
| Stripe amount | Server-computed from validated inputs; client `amount` ignored |
| Open redirect | Stripe success/cancel URLs built from canonical URL, never user's `Origin` header in prod |
| Bot protection | reCAPTCHA v3 server-verified; score < 0.5 rejected |
| DoS protection | Firestore-backed rate limit on `/api/create-checkout` (per IP + per email) |
| Input validation | Sanitizer in `lib/orderValidation.ts` — caps strings/arrays, drops unknown fields |
| Firestore | Security rules deny all client access; only Admin SDK (server) can read/write |
| Webhook | Stripe signature verified via `constructEvent`; idempotency check on order status |
| Draft posts | `/api/posts` returns drafts only to authenticated admin |

## Firebase Console Setup (one-time)

1. **Firestore Database → Rules** — must be deny-all (server bypasses via Admin SDK):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} { allow read, write: if false; }
     }
   }
   ```
2. **Authentication → Sign-in providers** — Google enabled
3. **Authentication → Authorized domains** — add your production domain
4. **Optional:** TTL policy on `rateLimits` collection, field `expireAt`

## Key Rules

- Route files in `app/**/page.tsx` are thin shells — import and render from `featured/` or `wizard/`
- Site copy lives in `lib/data.ts` (small static lists). Dynamic content lives in `src/content/`
- Each component owns its scoped `.css` file. No inline styles except for dynamic values (parallax offsets, etc.)
- Client components (interactive) start with `"use client"`
- All colors via CSS variables — no hardcoded hex outside `globals.css`
- API routes that mutate state are double-gated: (1) production check (404 or 403) + (2) `requireAdmin()` cookie check
- Anything user-supplied is sanitized before it touches Firestore or Stripe
- JSON content edits flow: local admin UI → JSON file → git push → Vercel rebuild
