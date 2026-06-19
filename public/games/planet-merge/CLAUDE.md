# Planet Merge CLAUDE.md

Suika-style merge game. Drop planets; two of the same kind merge into the next size up. Reach two Suns and they vanish for a bonus. Stack above the danger line means game over.

Read [`../CLAUDE.md`](../CLAUDE.md) first for cross-game rules (iframe, scroll lock, dev mode) and the project-wide writing-style rule (no em dashes).

---

## Source of truth for player-facing rules is the blog post

The post's `blocks` array in [src/content/posts.json](../../../src/content/posts.json) (the `planet-merge` entry) is what players read under the game and is the **authoritative description of game rules**: how chains work, what each superpower does, the planet roster, and the design intent.

When asked about game mechanics, planet behaviour, or the "feel" of the game, **read those blocks first**. They render under the iframe on `/games/planet-merge` so users and you see the same description.

Rule: if you change a mechanic in code, update the matching block in `posts.json`. If you change a block to describe a new mechanic, the code must follow. Treat code-vs-blocks drift as a bug.

---

## Stack

- **Vanilla ES modules.** No bundler, no npm. Load via local server (live-server, `npx serve`).
- **Matter.js** (CDN). Physics engine.
- **poly-decomp** (CDN). Concave decomposition for SVG silhouette colliders.
- **No framework** for UI. Direct DOM manipulation.

---

## File map (THE source of truth, do not duplicate logic across files)

| File | Owns |
|---|---|
| [config.js](config.js) | All shape definitions, layout constants, drop weights. **THE file to edit for balance / new planets.** |
| [physics.js](physics.js) | Matter.js engine setup, walls, body tracking maps, SVG silhouette collider loading, body spawn/despawn, `wakeAllShapes`, `separateOverlapping`. |
| [renderer.js](renderer.js) | All canvas drawing. Procedural shapes, asset bitmaps, flash/popup effects, next-canvas preview. |
| [game.js](game.js) | Game loop, input, merge/vanish queues, chain counter, superpower logic, restart, dev panel wiring. Module entry point. |
| [play.html](play.html) | DOM scaffold: game canvas, score/next panels, dev panel, game-over overlay. Loads Matter.js + poly-decomp from CDN globals before importing `game.js`. |
| [style.css](style.css) | All styling. See [`../CLAUDE.md`](../CLAUDE.md) for required iframe/scroll rules. |

---

## Coordinate system

- **Canvas internal resolution: 840 × 927 px** (from `LAYOUT.W` × `LAYOUT.H` in config.js).
- CSS scales the canvas down on smaller viewports; gameplay coords are always canvas-internal.
- `WALL = 34`: wall thickness. Playfield x range is `[WALL, W-WALL]`.
- `DROP_Y = 81`: y of the planet waiting to drop at the top.
- `DANGER_Y = 133`: red dashed line. A settled planet above this for 1.6s ends the game.
- `BASE_R = 216`: pixel radius of a Sun (size 100). All other radii = `size/100 * BASE_R`.

---

## Planet pipeline

```
config.js: SHAPES[] (12 planets, smallest to largest)
   ├── droppable: true/false → eligible to fall from the top
   ├── dropRate: weighted probability among droppables
   ├── outline: true → use SVG silhouette as collider (concave decomp)
   └── asset: <filename> in assets/images/
```

Currently droppable: Stars, Moon, Pluto, Mercury, Mars (levels 0-4). Larger planets only appear via merge.

To add a planet: append to `SHAPES`. Drop weights and merge chain are derived automatically.

---

## Per-drop chain and superpowers (current logic, don't revert)

Each merge from ONE drop's cascade bumps `chainCount`. Counter resets every drop.

- **`CHOOSE_UNLOCK = 3`** merges in one chain grants 1 "pick your next planet" charge (consumed on the next drop). UI: arrows on the NEXT panel become active.
- **`DESTROY_UNLOCK = 5`** merges in one chain grants 1 "wipe a planet type" charge (consumed when the player clicks any planet on the board; every body of that level dies). UI: pulsing red crosshairs paint over every body.

Charges persist across drops until spent. There is NO time-based combo decay. The only way to lose a chain in progress is to drop another planet.

History: this used to be a timer-based combo (3s window across drops) with thresholds at 2 and 5. Don't reintroduce the timer. Chains are intentionally a per-drop skill reward now.

---

## Physics quirks (each one fixes a specific real bug, don't remove without reading the comment)

### `wakeAllShapes()` after every merge / vanish / destroy
Matter.js doesn't propagate wake events up through chains. A body 3 layers up a stack stays frozen when the support below merges. Waking every sleeping shape on every merge fixes "floating planets". Cost is negligible at ~30 bodies max.

### Impact kick (`IMPACT_KICK_STRENGTH` in game.js collisionStart)
Real momentum transfer from a tiny Star onto a heavy Mercury is almost zero, so a stack barely reacts to drops without this. We add a velocity-scaled kick along the contact normal scaled by `sqrt(mass)`, so heavy targets feel a real shove but light Stars don't fly off-screen.

### Anti-balance nudge (`collisionActive` handler)
Two circles in vertical contact are at unstable equilibrium. Physics says the top one falls off, but Matter.js's friction + sleeping happily lets it sit forever. We nudge the top body horizontally on any near-vertical-normal persistent contact.

### Compound body parent walking
Concave planets (Moon, Saturn, Sun, anything with `outline: true`) become **compound bodies** via `Bodies.fromVertices` + poly-decomp. Their sub-parts fire collision events individually, so always walk up to `pair.bodyA.parent` before looking up `bodyLvl`, or merges silently never fire for compound planets.

### `kickedThisTick` dedup
Compound bodies fire one collision pair per sub-part, so the same logical planet-vs-planet impact fires N times per tick. Without the dedup set, the impact kick gets applied N times and explodes the stack.

### `renderOffset` for asymmetric silhouettes
`Bodies.fromVertices` translates every vertex so the centre of mass lands at the spawn point. The SVG viewBox centre (where the rendered image expects the body to sit) is offset from that by the area-weighted centroid. Without `body.renderOffset`, asymmetric planets like Saturn float above their actual collider.

### 64-sided circle approximation
Matter's default circle is a 14-26 sided polygon. The flat edges cause deterministic lateral drift after bouncing, so a planet that should bounce straight up walks sideways. Forcing 64 sides hides the drift below the friction threshold.

### 2 physics substeps per game tick
The game loop runs `Engine.update(engine, 8)` twice per frame instead of `Engine.update(engine, 16)` once. Smaller dt prevents fast small bodies (a falling Star) from tunneling through concave polygon planets (the Moon).

---

## SVG silhouette loading

Planets marked `outline: true` need their collider built from an SVG path. The SVG file must contain one or more `<path id="silhouette*">` elements (Illustrator mangles ids like `silhouette_0000_..._`, so the code matches by prefix).

Vertices are sampled at 12px intervals along the path and normalized relative to the **SVG viewBox centre** (not the silhouette's own bbox) so the collider and rendered image share the same origin.

If poly-decomp is missing or the silhouette is malformed, `Bodies.fromVertices` returns null and the code falls back to a plain circle. Check the console warnings.

---

## Dev panel (admin only, `?dev=1`)

**Local dev URL (skips the brzio wrapper, loads the game raw with the dev panel unlocked):**

```
http://localhost:3000/games/planet-merge/play.html?dev=1
```

Start the brzio app with `npm run dev` first. Production (`brzio.com`) does not expose the dev panel: the iframe wrapper only appends `?dev=1` for authenticated admins in `npm run dev`, and writing the query string by hand in prod just toggles a CSS class with nothing privileged behind it.

| Control | Effect |
|---|---|
| **Auto-Drop** | Auto-drops at fixed x (auto-x slider) for stress-testing |
| **Speed** | Physics time multiplier 1× to 10× |
| **Drop X** | x position for auto-drop, 0-100% |
| **Drop** | `weighted` (default) / `random` (uniform across all 12) / specific level |
| **Colliders** | Debug overlay showing actual physics shapes |
| **Stats** | Drops / games / avg score this session |

---

## Mode progression (locked easy → normal → hard)

Modes unlock in order. Easy is always playable; normal unlocks once easy is "cleared", hard unlocks once normal is cleared. A mode is **cleared when two Suns vanish into each other** (the existing max-level vanish event). Unlock state persists in `localStorage` under `pm_unlocked_modes` (easy is always forced in, even with empty/blocked storage).

- `MODE_ORDER`, `unlockedModes` (a Set), `loadUnlocks`/`saveUnlocks`/`isUnlocked` live near the top of game.js.
- `refreshDifficultyLocks()` toggles `.locked` (greyed + 🔒 badge + "Finish X to unlock" hint) on each `.diff-btn` and disables it. Called on load, when reopening the picker, and after a clear.
- `startGame(diff)` early-returns if the mode is not unlocked. The `.diff-btn` click handler is also inert for locked modes.

### Win sequence (`startWinSequence` in flushVanishes)

When two Suns vanish, `startWinSequence(mx, my)` records the unlock and plays a wipe:
1. A white circle grows from the merge point to cover the canvas (`WIN_GROW_MS`, easeOutCubic), drawn last in `frame()` via `drawWinAnimation()`.
2. Holds as a full white screen (`WIN_HOLD_MS`).
3. `#win-overlay` popup fades in with "You have unlocked <Next> mode!" (or a master message after hard). Continue reopens the picker.

Timing uses `performance.now()` (wall clock), not `totalMs`, because physics freezes while `winActive` is true. `winActive` also blocks `drop()` and canvas clicks. `clearWinState()` resets it on restart, new game, and continue.

## Perks (collectible achievements)

A data-driven achievement system. Everything is keyed off the `PERKS` array near the top of game.js, so adding a perk is just a new entry there (plus a call to `earnPerk(id)` at the moment it should unlock).

- **Tabs:** `wins`, `merges`, `losing`. Each perk has `{ id, tab, title, goal, emoji|img }`.
- **Current perks:** Wins = `win-easy` / `win-normal` / `win-hard` (earned in `startWinSequence`) + `win-200` (200 merges in a run, checked in `flushMerges`). Merges = one `merge-<lvl>` per **merge-only** planet (Earth, Uranus, Neptune, Saturn, Jupiter, Sun), earned the first time it's created in `flushMerges`. Droppable planets get no perk: `EVER_DROPPABLE` excludes everything in any drop pool, including Venus (which drops on easy). Losing = `lose-under-100` (earned in `endGame` when score < 100).
- **Persistence:** earned ids live in `localStorage` under `pm_earned_perks` (`earnedPerks` Set). `earnPerk(id)` is idempotent.
- **UI:** `#perk-card` (under the merges panel, in `#score-col`) shows `earned/total` and opens `#perks-overlay` (full-stage, tabbed 4-wide grid). It is deliberately NOT a bag icon.
- **Unlock animation:** `earnPerk` → a `.perk-toast` pops at screen centre, then flies into `#perk-card` (which pulses). Toasts are queued (`perkToastQueue`) so simultaneous unlocks play one at a time.
- Dropping is blocked while the perks overlay is open (`perksOpen()` guard in `drop()`).

## Restart

`restart-btn` click handler in game.js:
- Removes all shape bodies from the world
- Clears `bodyLvl`, `bodyBorn`, `active`, all queues, flashes, popups
- Resets score, drop state, chain, charges
- Hides game-over overlay
- Does NOT reload the page (jankier inside iframe)

---

## When changing things, common pitfalls

- **New planet:** just append to `SHAPES`. Don't hardcode indexes anywhere. Use `SHAPES.length - 1` for "max level", `SHAPES[lvl].pts` for score, etc.
- **Tuning physics feel:** `restitution`, `friction`, `frictionStatic`, `frictionAir`, `density` are in `spawn()` in physics.js. Gravity in `Engine.create({ gravity: { y: 1.8 } })`.
- **New superpower:** add a threshold constant, state variable, UI updater, and granting branch in `registerChain`. Mirror how `CHOOSE_UNLOCK` and `DESTROY_UNLOCK` work.
- **Don't put logic in renderer.js.** Renderer is read-only: it inspects state and draws. State mutations belong in game.js or physics.js.
- **Don't bypass spawn() / despawn().** Those keep `bodyLvl` / `bodyBorn` / `active` in sync. Mutating `World` directly without updating the maps causes ghosts.
