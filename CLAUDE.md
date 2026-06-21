# Brzio CLAUDE.md

Free browser mini-games site. Built on the bones of a previous marketing site, stripped down to: home (game grid) → game page (iframe embed) → optional devlog blog.

## Writing style (applies to ALL prose: blog posts, commits, comments, chat)

- **Never use em dashes (`—`).** The user does not write with them and reading them back is grating. Use a period, a colon, parentheses, or a comma instead. Same for en dashes (`–`) in prose.
- This rule covers `posts.json` blocks, code comments, commit messages, PR descriptions, every CLAUDE.md, and chat replies. Hyphens in compound words ("self-contained") and code identifiers are fine.
- Common rewrites:
  - `"X — Y"` (parenthetical) → `"X, Y"` or `"X (Y)"`
  - `"X — Y"` (consequence) → `"X. Y"` or `"X: Y"`
  - `"X — not Y"` → `"X, not Y"`

## Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript strict
- **Styling:** Vanilla CSS. `globals.css` holds tokens; one scoped `.css` per component. No Tailwind, no CSS-in-JS.
- **Fonts:** DM Sans (UI) via `next/font/google`
- **Content storage:** JSON files in `src/content/` (posts + seo) committed to git
- **Auth:** Firebase Auth (Google sign-in) issues a JWT cookie (`jose`). Admin only.
- **Games:** Static HTML/JS in `/public/games/<slug>/`. Each game ships its own `play.html` (not `index.html`, which would conflict with the Next.js `/games/[slug]` route and bypass the wrapper page).
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
      admin-auth/route.ts             ← Login: verifies Firebase ID token, sets JWT cookie
      admin-check/route.ts            ← Cookie check for NavBar admin link
      posts/route.ts, [id]/route.ts   ← Local-only: write to posts.json
      seo/route.ts                    ← Local-only: write to seo.json
      upload/route.ts                 ← Local-only: write images to /public

  components/
    ui/                               ← BrandLogo, Button, Input, SectionHeading, BlogPostHero, BlogPostBody
    sections/                         ← NavBar, Footer

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

- **`type: "blog"`** appears on `/blog` list and `/blog/<slug>`. Standard article body via `blocks` (preferred) or legacy `content` HTML.
- **`type: "game"`** appears on the home page game grid and on `/games/<slug>`. Required extra field: `gameSlug` (folder name inside `/public/games/`). Optional `blocks` show below the embed (how-to-play, credits).

To add a custom-wrapped game, drop a `Foo.tsx` in `src/featured-games/` and register it in `registry.tsx` keyed by the post slug. Without a registry entry, the slug falls back to the generic `<GameEmbed>` iframe.

### Block types available in `posts.json` `blocks`

See [src/lib/content.ts](src/lib/content.ts) for the canonical schema:

- `section` (optional heading + paragraph body)
- `banner` (full-width image)
- `split` (image + heading + body, left or right layout)
- `card-grid` (array of `{ src?, heading, body }` cards). Optional `variant: "icon"` shows the full image with padding instead of cropping (use for planet icons, logos, badges).
- `highlight` (callout, `variant: "green" | "rose"`)
- `quote`

Player-facing rules for each game live in that game's post `blocks`. The game-folder CLAUDE.md points back to those blocks as the source of truth for behaviour. Code-vs-blocks drift is a bug.

## Adding a New Game

1. Drop the game's self-contained HTML/CSS/JS into `/public/games/<folder>/` with a `play.html` entry point.
2. `npm run dev`, sign in at `/admin/login`, go to `/admin/posts/new?type=game`.
3. Pick the folder from the "Game Folder" dropdown, set a title/slug/excerpt/thumbnail, publish.
4. (Optional) For a custom layout, wrap the iframe in a new `featured-games/<Name>.tsx` and add `slug → Component` in `registry.tsx`.
5. `git add -A && git commit && git push`. Vercel rebuilds and the game is live.

## Environment Variables

`.env.local` (never commit). Mirror the required ones in Vercel.

```
# Admin sessions. REQUIRED. 32+ chars. openssl rand -base64 48
ADMIN_SESSION_SECRET=

# Firebase Admin SDK. REQUIRED for admin login (verifies Google ID tokens).
FIREBASE_ADMIN_PROJECT_ID=
FIREBASE_ADMIN_CLIENT_EMAIL=
FIREBASE_ADMIN_PRIVATE_KEY=

# Firebase client SDK. Google sign-in only.
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Optional. Canonical site URL.
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

- **Whitelist:** `nikodola@gmail.com` (hardcoded in `proxy.ts`, `requireAdmin.ts`, `admin-auth/route.ts`, `admin-check/route.ts`)
- **Auth:** Google, then Firebase ID token, then HS256 JWT in the `admin_session` HttpOnly cookie (7d)
- **Production:** `/admin/*` and write-side APIs (`/api/posts`, `/api/seo`, `/api/upload`, `/api/admin-*`) all return 404 via `proxy.ts`. Admin only works in `npm run dev`.

## Key Rules

- Route files in `app/**/page.tsx` are thin shells. Import and render from `featured/` or `featured-games/`.
- Each component owns its scoped `.css` file. No inline styles except for dynamic values.
- Client components (interactive) start with `"use client"`.
- All colors via CSS variables. No hardcoded hex outside `globals.css`.
- Write-side API routes are double-gated: production check (404) + `requireAdmin()` cookie check.
- JSON content edits flow: local admin UI, then JSON file, then git push, then Vercel rebuild.
