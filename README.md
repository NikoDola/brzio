# The Logo Professionals

Marketing site + multi-step order configurator for logo design, logo redesign, and website projects. Built with Next.js 16 and Stripe.

Public site: [thelogoprofessionals.com](https://thelogoprofessionals.com)

---

## Quick start

```bash
git clone <repo-url>
cd Logo-professionals
npm install
cp .env.local.example .env.local   # fill in the values
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

> **Required env vars** before the app will boot:
> `ADMIN_SESSION_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, the six `FIREBASE_ADMIN_*` / `NEXT_PUBLIC_FIREBASE_*` keys, and the reCAPTCHA pair.
> Full list and where to get each one is in [`CLAUDE.md`](./CLAUDE.md#environment-variables).

---

## How to publish content (blog, portfolio, team)

Content lives in JSON files in the repo. The admin UI only runs locally — there is no way to add content from a deployed site.

1. `npm run dev`
2. Open [http://localhost:3000/admin/login](http://localhost:3000/admin/login)
3. Sign in with an authorized Google account (`igor.dolovski@gmail.com` or `nikodola@gmail.com`)
4. Add or edit:
   - **Blog post / portfolio item** → `/admin/posts`
   - **Team member** → `/admin/team`
5. Upload images directly in the form — they get saved to `/public/<folder>/`
6. Hit **Save**. The change writes to `src/content/posts.json` or `src/content/team.json` and the image lives in `/public/`
7. Commit and push:
   ```bash
   git add -A
   git commit -m "new post: <title>"
   git push
   ```
8. Vercel rebuilds. New content is live in ~1 minute as a static page.

**Why local only?** Production is read-only — you can't accidentally lose data, the JSON is your single source of truth, every change is in git history.

---

## How to view orders

Orders flow into Firebase Firestore when customers pay.

- **Locally:** `npm run dev` → [http://localhost:3000/admin/orders](http://localhost:3000/admin/orders)
- **From anywhere:** Firebase Console → Firestore Database → `orders` collection

The Stripe webhook automatically marks orders as `paid` after successful payment. Pending orders are checkout sessions that were started but never completed.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on `localhost:3000` |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

---

## Deploying

This site deploys to Vercel.

1. Push to `main` — Vercel auto-deploys
2. Make sure all env vars from [`CLAUDE.md`](./CLAUDE.md#environment-variables) are set in **Vercel → Settings → Environment Variables** (Production + Preview)
3. Stripe webhook endpoint must point to `https://thelogoprofessionals.com/api/stripe-webhook` (configure in [Stripe Dashboard](https://dashboard.stripe.com/webhooks) — listen for `checkout.session.completed`)
4. Firebase Console → Authentication → Authorized domains must include your production domain

---

## Project layout (quick map)

```
src/
  app/(public)/         ← Public pages (home, blog, portfolio, about, contact)
  app/services/         ← Order wizard
  app/admin/            ← Local-only admin (404 in production)
  app/api/              ← API routes (checkout, webhook, content writes)
  content/              ← posts.json + team.json (the content you edit)
  components/           ← Reusable UI + sections
  featured/             ← Full-page components
  wizard/               ← Multi-step services configurator
  lib/                  ← Auth, content, pricing, validation, rate limiting
```

Detailed structure + security model + payment flow: see [`CLAUDE.md`](./CLAUDE.md).

---

## Troubleshooting

**`npm run dev` errors with "ADMIN_SESSION_SECRET is missing or too short"**
Set it in `.env.local`. Generate a value with `openssl rand -base64 48`.

**Admin pages keep redirecting to `/admin/login`**
Cookie is missing or expired. Sign in again. If still broken, your Google account isn't in the whitelist — check `proxy.ts`.

**Stripe checkout returns 403 "Bot-like activity detected"**
reCAPTCHA score is below 0.5. Either you're behind a strange network (try another), or `RECAPTCHA_SECRET_KEY` is set but the site key isn't for the same reCAPTCHA site.

**Stripe checkout returns 429**
Rate limited — wait 15 minutes. Limits are 5 attempts per IP / 3 per email per 15-min window.

**Order isn't marked "paid" after payment**
Stripe webhook isn't reaching you. Check Stripe Dashboard → Webhooks → recent deliveries for errors. Most common cause: `STRIPE_WEBHOOK_SECRET` in your env doesn't match the secret shown in Stripe Dashboard for that webhook endpoint.

**Image upload says "Unsupported file type"**
Only JPG, PNG, WebP, GIF (images) and MP4, WebM, MOV (video) are allowed. SVG is intentionally blocked.

**Production deploy shows blank navbar dropdown**
Team JSON wasn't rebuilt. Check `src/content/team.json` is committed and Vercel finished the latest build.

---

## License

Proprietary — © The Logo Professionals.
