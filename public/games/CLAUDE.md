# `public/games/` Folder Guide

This folder holds self-contained mini-games. Each game lives in its own subfolder and ships static HTML/JS/CSS that runs entirely in the browser. No build step.

Read this file when working in ANY game subfolder. For game-specific architecture, also read that game's own `CLAUDE.md`.

---

## Folder convention

```
public/games/
├── CLAUDE.md           ← you are here (global rules for all games)
├── <slug>/
│   ├── play.html       ← entry point, must be named exactly this
│   ├── CLAUDE.md       ← game-specific architecture + rules
│   └── ... (game's own JS/CSS/assets)
```

The folder name is the **game slug**. The brzio site references it via the `gameSlug` field on a `type: "game"` post in `src/content/posts.json`.

**Why `play.html` and not `index.html`:** if the entry file were `index.html`, Vercel would serve it directly at `/games/<slug>` (treating the folder as a static directory). That bypasses the Next.js wrapper page entirely and breaks relative asset paths (no trailing slash means `style.css` resolves to `/games/style.css`, not `/games/<slug>/style.css`). Naming the entry `play.html` keeps the `/games/<slug>` route owned by Next.js, and the iframe inside it loads `/games/<slug>/play.html`.

---

## How a game is loaded by brzio

1. User visits `/games/<post-slug>` on the brzio site.
2. Next.js renders [src/app/(public)/games/[slug]/page.tsx](../../src/app/(public)/games/[slug]/page.tsx).
3. The page looks up a custom wrapper in [src/featured-games/registry.tsx](../../src/featured-games/registry.tsx) keyed by post slug. If none, it falls back to the generic `<GameEmbed>`.
4. The wrapper iframes `/games/<gameSlug>/play.html` (path is relative to `/public`).
5. Authenticated admins get `?dev=1` appended to the iframe `src`.

**The game has NO knowledge of the parent brzio site.** It runs sandboxed in an iframe.

---

## Dev mode (`?dev=1`)

Each game's `play.html` should include:

```html
<script>
  if (new URLSearchParams(location.search).get('dev') === '1') {
    document.documentElement.classList.add('dev-mode');
  }
</script>
```

CSS then keys dev-only UI off `html.dev-mode`:

```css
#dev-panel { display: none; }
html.dev-mode #dev-panel { display: flex; }
```

`?dev=1` is set by the parent page server-side via [src/lib/auth/requireAdmin.ts](../../src/lib/auth/requireAdmin.ts). Never trust `?dev=1` for anything security-sensitive. It's a UI hint, not auth.

---

## Iframe scrolling, required setup

Iframes are tricky: if the game's content doesn't fill the iframe height exactly, a scrollbar appears inside the iframe. If the iframe has no scrollable content and the user mouse-wheels over it, the **parent brzio page** scrolls instead.

Every game's CSS must include:

```css
html {
  overflow: hidden;
  overscroll-behavior: none;
}
body {
  overflow: hidden;
  /* ... */
}
```

And every game's `play.html` must include this in the head script:

```js
window.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
```

Without that listener, wheel events bubble out and scroll the brzio page beneath the game.

For touch input, set `touch-action: none` on any element that handles drag (typically the canvas).

---

## Iframe sizing, set by the wrapper not the game

The iframe's `max-width` and `height` are controlled by the **brzio-side wrapper** (e.g. [src/featured-games/PlanetMerge.css](../../src/featured-games/PlanetMerge.css)), NOT by the game's own CSS.

- The game can assume `body { min-height: 100vh }` will give it the iframe height.
- Pick iframe dimensions in the wrapper that match the game's natural content height, otherwise you get dead dark space.
- Don't use `aspect-ratio` for the iframe on desktop unless the game scales linearly with width; fixed `height` is more predictable.

---

## Adding a new game

1. Drop the game folder into `public/games/<slug>/` with `play.html`.
2. Add a `CLAUDE.md` to the new folder documenting its architecture.
3. (Optional) Create `src/featured-games/<Name>.tsx` for a custom wrapper; register in `registry.tsx`.
4. In dev (`npm run dev`), sign in at `/admin/login`, create a `type: "game"` post pointing at the folder.
5. Commit and push. Vercel rebuilds.

---

## Player-facing rules live in the post `blocks` array

Each game's entry in [src/content/posts.json](../../src/content/posts.json) has a `blocks` field that renders **under the iframe** on `/games/<slug>`. That's the in-app explainer the player sees and is the **authoritative description of how the game works**: chains, powers, controls, roster, vibe.

When asked about a game's mechanics or "what does X do", **check the blocks for that game first**. They're shorter and more honest than re-reading the code. The game's own `CLAUDE.md` covers architecture/internals; the blocks cover behaviour.

If you change a mechanic in code, update the matching block. If a block describes a mechanic that isn't in code yet, treat that as the spec to implement. Drift between blocks and code is a bug.

---

## Conventions all games should follow

- **Self-contained.** No imports from the brzio src. The game folder should run standalone if you serve it directly.
- **ES modules.** Use `<script type="module">` so code is split into focused files. Open via a local server, not `file://`.
- **No build step.** Plain JS / CSS / HTML. CDN imports are fine.
- **Touch + mouse parity.** Every drag/click handler needs a touch equivalent.
- **Restart without page reload.** The game should expose a restart that resets all state in-place. Page reloads inside iframes are visibly janky.
- **Dev panel for tuning.** Anything you'd tweak repeatedly during balancing (drop rates, physics constants, debug overlays) belongs behind `?dev=1`.
