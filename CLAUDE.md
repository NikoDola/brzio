# Brzio — CLAUDE.md

Free browser mini-games site. Built on the bones of a previous marketing site, stripped down to: home (game grid) → game page (iframe embed) → optional devlog blog.

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript strict
- **Styling:** Vanilla CSS — `globals.css` for tokens + one scoped `.css` per component. No Tailwind, no CSS-in-JS.
- **Fonts:** DM Sans (UI) via `next/font/google`
- **Content storage:** JSON files in `src/content/` (posts + seo) committed to git
- **Auth:** Firebase Auth (Google sign-in) → JWT cookie (`jose`) — admin only
- **Games:** Static HTML/JS in `/public/games/<slug>/` — each game ships its own `index.html`
- **Package manager:** npm

## Folder Structure

```
src/
  app/
    layout.tsx                        ← Root: fonts + JSON-LD
    globals.css                       ← Design tokens + base styles
    robots.ts, sitemap.ts
    (public)/                         ← Route group: NavBar + Footer wrapper
      layout.tsx
      page.tsx                        ← / → <HomePage /> (game grid)
      games/[slug]/page.tsx           ← Loads game post + renders featured-games component
      blog/page.tsx, [slug]/page.tsx
    admin/                            ← 404 in production via proxy.ts
      layout.tsx, page.tsx, AdminSidebar.tsx
      login/page.tsx                  ← Google sign-in
      posts/page.tsx, new, [id], PostForm, PostsList, BlockBuilder, DeletePostBtn
      seo/page.tsx, SeoForm.tsx
    api/
      admin-auth/route.ts             ← Login: verifies Firebase ID token → JWT cookie
      admin-check/route.ts            ← Cookie check for NavBar admin link
      posts/route.ts, [id]/route.ts   ← Local-only: write to posts.json
      seo/route.ts                    ← Local-only: write to seo.json
      upload/route.ts                 ← Local-only: write images to /public

  components/
    ui/                               ← BrandLogo, Button, Input, SectionHeading, BlogPostHero, BlogPostBody
    sections/                         ← NavBar, Footer, UnderConstruction

  featured/                           ← Full-page server components for routes
    HomePage.tsx                      ← Renders game grid

  featured-games/                     ← One component per game
    GameEmbed.tsx                     ← Generic iframe wrapper (used by default fallback)
    PlanetMerge.tsx                   ← Custom wrapper for /games/planet-merge
    registry.tsx                      ← slug → component map (falls back to GameEmbed)

  content/
    posts.json                        ← Blog + game entries (Post type)
    seo.json                          ← Per-route meta

  lib/
    content.ts                        ← Post/SeoEntry types + JSON IO. Writes blocked in prod.
    seo.ts                            ← SITE_NAME, SITE_URL, metadata helpers, JSON-LD builders
    firebase/admin.ts, index.ts       ← Admin SDK + client SDK (auth only)
    auth/requireAdmin.ts, sessionSecret.ts

  proxy.ts                            ← Next.js middleware. Gates /admin & write-APIs in prod.
                                        Rewrites non-localhost requests to /under-construction.
```

## Post Types

`posts.json` holds two kinds of entries, distinguished by `type`:

- **`type: "blog"`** — appears on `/blog` list and `/blog/<slug>`. Standard article body via `blocks` (preferred) or legacy `content` HTML.
- **`type: "game"`** — appears on the home page game grid and on `/games/<slug>`. Required extra field: `gameSlug` — folder name inside `/public/games/`. Optional `blocks` show below the embed (how-to-play, credits).

To add a custom-wrapped game, drop a `Foo.tsx` in `src/featured-games/` and register it in `registry.tsx` keyed by the post slug. Without a registry entry, the slug falls back to the generic `<GameEmbed>` iframe.

## Adding a New Game

1. Drop the game's self-contained HTML/CSS/JS into `/public/games/<folder>/` with an `index.html` entry point.
2. `npm run dev`, sign in at `/admin/login`, go to `/admin/posts/new?type=game`.
3. Pick the folder from the "Game Folder" dropdown, set a title/slug/excerpt/thumbnail, publish.
4. (Optional) For a custom layout — wrap the iframe in a new `featured-games/<Name>.tsx`, add `slug → Component` in `registry.tsx`.
5. `git add -A && git commit && git push` — Vercel rebuilds and the game is live.

## Environment Variables

`.env.local` (never commit). Mirror the required ones in Vercel.

```
# Admin sessions — REQUIRED. 32+ chars. openssl rand -base64 48
ADMIN_SESSION_SECRET=

# Firebase Admin SDK — REQUIRED for admin login (verifies Google ID tokens)
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Firebase client SDK — Google sign-in only
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Optional — canonical site URL
NEXT_PUBLIC_SITE_URL=https://brzio.com
```

## Commands

```bash
npm run dev      # localhost:3000
npm run build    # production build
npm run start    # serve production build
npm run lint     # ESLint
```

## Admin

- **Whitelist:** `igor.dolovski@gmail.com`, `nikodola@gmail.com` (hardcoded in `proxy.ts`, `requireAdmin.ts`, `admin-auth/route.ts`)
- **Auth:** Google → Firebase ID token → HS256 JWT in `admin_session` HttpOnly cookie (7d)
- **Production:** `/admin/*`, write-side APIs (`/api/posts`, `/api/seo`, `/api/upload`, `/api/admin-*`) all return 404 via `proxy.ts`. Admin only works in `npm run dev`.

## Under-construction Gate

`proxy.ts` rewrites any non-localhost request (other than `/under-construction`) to `/under-construction`. Remove that block when ready to launch publicly.

## Key Rules

- Route files in `app/**/page.tsx` are thin shells — import and render from `featured/` or `featured-games/`.
- Each component owns its scoped `.css` file. No inline styles except for dynamic values.
- Client components (interactive) start with `"use client"`.
- All colors via CSS variables — no hardcoded hex outside `globals.css`.
- Write-side API routes are double-gated: production check (404) + `requireAdmin()` cookie check.
- JSON content edits flow: local admin UI → JSON file → git push → Vercel rebuild.
