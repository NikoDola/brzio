# Planet Merge

A Suika-style merge game. A little ship follows your pointer along the top and drops planets into an open container; two of the same kind touching merge into the next size up. Get two Suns to touch and they pop for a bonus. The container is open at the top: overfill it and planets get pushed over the rim. A planet falling out of the container ends the game, and so does a board so crowded that an Earth-sized planet has nowhere left to drop.

Before diving in here, read [`../CLAUDE.md`](../CLAUDE.md). It covers the rules shared by every game on the site (iframe embedding, scroll locking, dev mode) and the site-wide writing rule: no em dashes, anywhere.

---

## The real rulebook is the blog post, not this file

The description players actually read sits under the game on the page. It lives in the `blocks` array of the `planet-merge` entry in [posts.json](../../../src/content/posts.json). That text is the official word on how the game plays: how chains work, what each power does, the full planet lineup, and the intent behind the design.

So when a question is about how the game feels or behaves, read those blocks first. They render right under the game, so you and the player are looking at the same explanation.

The one hard rule: code and blog post must agree. Change a mechanic in the code, update the matching block. Change a block to promise something new, make the code do it. If they ever disagree, that is a bug, not a style choice.

---

## What it's built with

- **Plain JavaScript modules.** No bundler, no npm, no build step. You need a local server to run it (live-server, or `npx serve`).
- **Matter.js** (loaded from a CDN) does the physics.
- **poly-decomp** (also CDN) lets us build oddly-shaped colliders from the planet artwork.
- The UI is hand-written DOM code. No React or any framework.

---

## Where everything lives

Each file has one job. Don't copy logic between them.

| File | What it handles |
|---|---|
| [config.js](config.js) | `LAYOUT` (canvas and ship geometry), `BALANCE` (chain thresholds, cooldowns, shake costs), and every planet's definition in `SHAPES`. **This is the file you edit to rebalance the game or add a planet.** |
| [tuning.js](tuning.js) | Live-tunable physics numbers (planet weight curve, impact kick, shake strength), shared by physics.js and the dev panel. |
| [physics.js](physics.js) | Everything Matter.js: the engine, the walls, the shield arch, tracking which body is which, building colliders from artwork, spawning and removing bodies. |
| [renderer.js](renderer.js) | All the drawing on the canvas: planets and their faces, the ship marker and its beam, the big sky score with the ship's shadow, effects, previews. It only reads game state and paints it. It never changes anything. |
| [game.js](game.js) | The brain and the entry point. Game loop, input, merges, the chain counter, superpowers, autopilot, the death replay, ship skins, save/restore, fullscreen, restart. |
| [state.js](state.js) | The tiny shared `round` flags (playing, game over) every other module reads. |
| [levels.js](levels.js) | The `LEVELS` ladder: the drop roster per level, power bans, the level-up toast, and the LEVEL hud cell with its current-level card. |
| [shakes.js](shakes.js) | The SHAKES meter, the shake itself, the rainbow shield, and the auto earthquake. |
| [perks.js](perks.js) | The `PERKS` list, the perks overlay, unlock toasts and animations. |
| [stats.js](stats.js) | Lifetime stats (games, best score, play time, best chain) in localStorage. |
| [settings.js](settings.js) | The Settings overlay: How to Play copy, sound toggle wiring, parent PIN, daily play-time limit. |
| [save-storage.js](save-storage.js) | The localStorage plumbing behind auto-save and the Continue button. |
| [audio.js](audio.js) | All sound effects and the mute flag. |
| [background.js](background.js) | The full-page starfield behind the game. |
| [planet-icons.js](planet-icons.js) | Shared DOM planet icons (legend, perk tiles, level toasts and cards) and the legend's show/hide/roster logic. |
| [dev-panel.js](dev-panel.js) | The `?dev=1` panel: auto-drop, sim speed, colliders, force-power toggles, physics sliders, storage clear, session stats. |
| [analytics.js](analytics.js) | Posts anonymous open/start/game-over/quit events to the site's `/api/stats` endpoint. Never breaks the game if the endpoint is missing. |
| [play.html](play.html) | The page skeleton: the canvas, the hud bar, every overlay, the dev panel. Loads Matter.js and poly-decomp before starting the game. |
| [style.css](style.css) | All the styling. |

---

## How positions work

The game thinks in a fixed canvas that is **840 wide by 1160 tall**, no matter what size the screen is. On smaller screens the canvas is scaled down visually, but the game math always uses those fixed numbers. (They come from `LAYOUT.W` and `LAYOUT.H` in config.js.)

A few key spots on that canvas:

- The playfield's inner edges sit at `WALL_X` = 60, so planets live between x=60 and x=780. The visible walls are 20px thick and drawn just outside those edges.
- The side walls only start at y=108 (`WALL_TOP` in config.js); above that the container is open air. The physics floor spans just the inner width, so a planet pushed over a wall has nothing to land on and falls out of the world. A red dashed warning line appears 50px below the ship once older board planets reach the top fifth of the container, but it is only a warning. Freshly dropped falling planets are ignored for this warning. It is not a collision boundary.
- The ship (the "player marker") is centred at y=73 and follows the pointer horizontally. The planet waiting to drop hangs just below it, so its y depends on its own radius (see `dropYFor` in game.js), roughly y=155 plus the radius.
- `BASE_R` = 216 is the radius of a hypothetical size-100 planet. The Sun is size 95, so the biggest real planet has a radius of about 205px. Every planet's radius is `size / 100 * BASE_R`.

---

## The ship, and how a drop actually flows

The old fixed crosshair is gone. What the player steers is a **ship**:

- An SVG skin (10:7, 212.5 x 148.75) drawn at `PLAYER_CONTAINER_Y`, following the live aim x. It **tilts** slightly toward its direction of travel (eased, capped at ~10 degrees) so it feels piloted.
- The **NEXT planet rides inside the ship** in a small slot. The old NEXT hud cell still exists in play.html but is `hidden`; don't resurrect it, the ship is the next-preview now.
- The **current planet hangs below the ship** at the end of a dashed guide line. Drop it and the next planet animates out of the ship's slot down into the waiting position (the "handoff", eased over one drop cooldown, 560ms).
- A teal **tractor beam** glows under the ship (`drawAlienBeam`). It's skipped on mobile for performance.
- The **big faded score** is painted in the open sky at y=61, and the ship's silhouette casts a moving shadow on the digits only (`drawScoreShadow`). The HUD score chip was removed; `scoreEl` in game.js is a stub object so old writes stay harmless.
- **Ship skins:** `SHIP_SKINS` in game.js (alien, baby, car, native-indian). The start screen has a prev/next selector; the choice persists in localStorage (`planet-merge-ship-skin`) and swaps the baked marker bitmap via `setPlayerMarkerAsset`.

Input: mouse move aims, click drops. On touch, the drop point snaps to wherever the finger lands, follows it while dragging, and drops on release. Spacebar also drops. Drops are refused while an overlay (perks, level card) is open, while the shake shield is up, during the drop cooldown, and while the Choose countdown is running.

When a board planet overlaps the drop spot, the waiting planet dims to 0.7 opacity, wears its hurt face, and a red cross covers it (`drawPreview`, flag from `dropBlockedAt`). Clicking there is refused, and a refused drop must NOT reset the chain counter.

---

## The planets

All 12 planets are defined in `SHAPES` in config.js, listed smallest to largest. Each one carries a few settings: its size, score value, drop weighting, which image file it uses, and whether it has face expressions or decorative accessories. **Every planet is a plain circle collider now** (`sides: 0`, no `outline`), so shape never affects physics.

One thing that trips people up: **the list of planets that can actually drop is not decided by the per-planet `droppable` flag.** It's decided by the `drops` list on each level in levels.js (the per-planet `dropRate` is still used, as the weighting within that roster). The `droppable` flag only feeds `rndLvl()` in config.js, which nothing calls anymore. In the live game, level 1 drops Moon, Pluto, Mercury, Mars, and Venus. Level 2 adds Stars. From level 3 on, Venus stops dropping. Every other planet only ever shows up by merging.

Most planets are `expressions: true`: the body SVG is faceless (`planet_earth_body.svg`) and separate casual/hurt/sad face overlays share its viewBox (`planet_earth_casual.svg` etc). A hit planet flinches (hurt, 1s), sulks (sad, 2s), then relaxes. Missing face files fail silently, so art can land incrementally.

**Accessories** are decorative bitmaps layered around a planet without ever touching the collider (which stays a plain circle). Saturn's ring and the Sun's corona + sunglasses are `accessories: [...]` entries on those `SHAPES` (see config.js for the schema: a `layer` of `back` or `front`, plus `wRatio`/`hRatio`/`inflatePx` for size and `xRatio`/`yRatio` for offset, all fractions of the body diameter). They're pure paint: the game draws every `back` accessory behind all planets, then all bodies + faces, then `front` accessories on top, so a ring never covers a neighbour and never collides. The Sun's sunglasses are the only `front` accessory.

To add a planet, just add it to `SHAPES`. The drop odds and the merge order sort themselves out.

---

## Chains and superpowers

Every time you drop a planet, any merges it sets off (including chain reactions) count up on a chain counter. That counter resets the moment you drop the next planet.

Hit enough merges in one drop and you earn a power:

**3 merges in one drop earns Choose Planet.** There are no pick arrows anymore. Instead:

1. A 3-2-1 countdown circle appears at the drop spot (`CHOOSE_READY_MS`, 3s). Dropping is blocked during the countdown.
2. Then the waiting planet **auto-cycles** through the current level's droppable roster, one planet every `CHOOSE_ROTATE_MS` (0.5s).
3. The player picks by timing the normal drop tap. The drop consumes the charge.

Choose is off at level 5+, and also whenever autopilot is on (an auto-cycling planet under an auto-dropper is chaos).

**5 merges in one drop earns Eliminate (destroy).** Pulsing pink crosshairs appear, but only on planets of droppable sizes: the big merge-only planets can't be wiped. Click (or tap) a target and every planet of that type is destroyed. Details that matter:

- Clicking empty space is NOT a miss-and-wait: it falls through to a normal drop. Only an actual target hit spends the charge.
- **The charge expires after 3 drops if unused** (`DESTROY_DROP_GRACE` in game.js). The overlay copy in play.html promises exactly this, keep them in sync.
- The explanation overlay shows only the first time ever (localStorage `planet-merge-destroy-help-seen`). Later charges just show crosshairs.
- Destroy supersedes Choose: earning it clears any pending Choose charge, so the two prompts never stack.

Eliminate is off from level 4 on. If you're holding a charge and cross into a level that bans that power, the charge is taken away right then (`revokeBannedCharges`). You can't smuggle a power into a level that forbids it.

(For the record: this used to be a timer-based combo system, with a 3-second window carrying across drops. That's gone on purpose. Chains are a per-drop skill reward, so please don't bring the timer back.)

---

## Autopilot (a player feature, not a dev tool)

The AUTO Pilot hud cell shows during a round on desktop. Toggling it sweeps the ship left-right and drops automatically whenever a drop is legal (it skips blocked spots instead of resetting the chain). A second button toggles **Fast** (4x sweep and 4x shorter cooldown).

- Desktop only: it's hidden whenever mobile perf mode is on, and force-stopped if a resize crosses into it.
- It disables Choose entirely while active. Destroy still works: crosshairs show and a click on a target spends the charge (but each auto-drop still ticks the 3-drop expiry).
- It stops itself on game over. Don't confuse it with the dev panel's Auto-Drop, which is a fixed-position stress-test tool.

---

## Physics oddities (each one fixes a real bug, so read before removing)

Every item here looks weird until you know the bug it kills. The comment in the code explains each; here's the plain-English version.

**We wake up every planet after each merge, vanish, or destroy.**
Matter.js won't wake a planet just because the one holding it up disappeared. So a planet three layers up a stack would freeze in mid-air ("floating planets"). Nudging every sleeping planet awake after each merge fixes it (with a negative sleep counter so it stays awake long enough to actually start falling), and with ~30 planets on screen it costs nothing.

**Drops give the stack a real shove ("impact kick").**
In real physics, a tiny Star landing on a heavy Mercury barely moves it, which felt dead. So we add an extra push along the point of contact, scaled so heavy planets feel a proper shove while light Stars don't rocket off the screen. You can tune this live with the "Impact" slider in the dev panel (1 is normal, 0 turns it off).

**Planet weight is adjustable; the default is flat density with a hard cap.**
How heavy each planet is comes from `densityFor()` in tuning.js. `massPower` controls how weight grows with size: 2 is flat density (mass follows area), 3 is volume-like. **The default is 2.0 (flat), and no planet may exceed `massRatioCap` (26) times the Star's mass.** Both exist because of the same bug: when a big planet vastly outweighs a small one (even flat density makes Jupiter ~40x a Moon, because area), Matter's solver cannot hold the contact open, so the small planet gets crushed deep inside the big one and the churning friction spins both. The cap keeps every big-vs-small contact solvable. The dev panel's mass slider still re-weighs planets on screen instantly, but the cap applies on top of it.

**Runaway spin is damped every step.**
Planets are circles, so no shape ever stops them rotating; friction impulses under load just keep torquing them ("spinning like crazy"). An `afterUpdate` hook in physics.js damps every awake planet's angular velocity slightly each step and clamps it at about one revolution per second. Gentle rolling survives; accumulated spin dies out in a couple of seconds. Don't remove it because things look calm, it is why they look calm.

**We give balancing planets a tiny sideways nudge.**
Two round planets stacked perfectly on top of each other should topple, but Matter.js's friction is happy to let them balance forever. So when we spot that perfectly-stacked situation, we nudge the top one sideways so it behaves naturally.

**Freshly-merged planets push their neighbours out.**
A merge spawns a bigger body at the midpoint of two smaller ones, which can leave a neighbour deeply intersecting it (and sleeping stuck like that). `separateOverlapping` translates any overlapping neighbour out along the contact normal, clamped inside the walls.

**No planet may sit deeply inside another (`separatePenetrations`).**
`separateOverlapping` only fires right after a merge, so a small planet driven deep into a big one by a wall clamp or a hard drop could stay embedded — frozen (both bodies asleep, so the solver ignores the pair) or spun by friction as the deep contact churns. So every physics step `separatePenetrations` scans planet pairs and, when two overlap *well beyond* normal resting slop (an `allowance` well above the couple-of-px the solver leaves at rest), it eases them apart along their centre line and **zeroes both bodies' linear AND angular velocity**. The zeroing is the whole trick: a bare position teleport with velocity left alone makes the freed planet orbit the other's rim, and leftover angular velocity is the "spinning like crazy" bug. The high allowance is also deliberate: settled stacks never trip it, so they still sleep calmly and only genuine embeddings are corrected. Don't lower the allowance to "tidy up" small overlaps; that reintroduces jitter.

**Planets that tunnel through a wall or the floor get pushed back in.**
The ONLY legal way out of the container is over the open rim. `preventIllegalContainerEscapes` and `checkOver` treat a planet outside the side-wall x range that never reached the rim as a physics glitch: it's clamped back inside instead of ending the run. Same for planets pushed below the floor.

**All planets are plain circles now (the compound-body path is dormant).**
No planet currently sets `outline: true`, so every collider is one simple circle and none is built from decomposed sub-pieces. Saturn's ring and the Sun's rays are decorative accessories, not collision geometry. The collision code still walks up to a body's parent before reading its level (harmless for circles), and the silhouette/poly-decomp machinery still exists, so an outline planet *could* be re-added, but nothing uses it today.

**We de-duplicate collision reports per tick.**
Added because the old compound planets fired one collision per sub-piece, so the same bump got reported many times and the impact kick stacked up. With every planet a single circle now it rarely triggers, but the guard is cheap and stays in case an outline planet returns.

**No planet may sit deeply inside another, and spin can't run away.**
Two circle-specific safety nets, both documented in full below: `separatePenetrations` eases apart any pair that overlaps far past normal resting slop (and zeroes their velocity so they don't orbit or spin), and an `afterUpdate` hook damps + caps every planet's angular velocity. See the two entries higher up.

**Circles are polygons, capped at 64 sides (32 on phones).**
Matter.js has no true circles; every "circle" is a polygon. Its default cap is a rough 14-to-26 sides, whose flat edges make a planet that should bounce straight up slowly drift sideways instead. We raise the cap to 64 to hide the drift; phones get 32 because collision solving is their bottleneck. Note the cap is a MAXIMUM: `Bodies.circle` also limits sides by pixel radius, so small planets already have far fewer (a Star is ~18-sided, a Moon ~26) and only Venus-and-up actually reach the cap. "Making planets polygons" is therefore not an optimization; they already are, and the knobs are this cap and the solver iterations.

**Solver iterations are the main physics cost knob.**
The engine runs `positionIterations: 14` / `velocityIterations: 8` (Matter defaults 6/4), raised to fix the crush bug. Resolver cost scales with iterations times contacts, so lowering them is the biggest physics saving available, but NEVER lower the default blindly: replay the saved crush Scenarios (dev panel) at the lower value first and confirm no planet embeds or spins. The dev panel's Solver Iter slider exists for exactly this experiment, and the Phys stat shows the live cost.

**Physics runs in fixed tiny steps.**
The game loop feeds real elapsed time into a bucket and drains it in fixed 8ms physics steps. Two reasons, both important. The tiny step stops a fast-falling Star from punching straight through a solid planet. And running on real time instead of frames means the game plays at the same speed on a 60Hz and a 144Hz monitor, and a laggy frame just costs a little sim time instead of snowballing.

Please don't switch back to "run physics N times per frame." That ties game speed to the monitor's refresh rate.

---

## Performance rules (these fixed real lag, please keep them)

- **Never draw an SVG image directly during gameplay.** Browsers redraw vector art from scratch almost every time, and this was the single biggest slowdown (it happened for every planet, every frame). Instead, renderer.js bakes each SVG once into an offscreen bitmap on load, and bakes body + face into **combined sprites** so a planet with a mood is still one `drawImage` per frame. One-off images that only appear once (the legend, perk icons, the start screen) can still use the SVG directly. That's fine.
- **No canvas filters during gameplay.** Filters force an extra hidden surface and a full pixel pass every draw. The ship's shadow on the sky score uses a pre-baked black silhouette instead of a brightness filter.
- **Mobile perf mode** (`mobilePerfMode()`: viewport ≤700px or a coarse pointer) renders the whole game canvas at 0.7 scale, skips the ship beam, swaps the score-shadow effect for a cached plain score bitmap, and uses the 32-sided circle colliders. Autopilot is hidden there too.
- **The background starfield is deliberately cheap:** it renders at plain screen resolution (no high-DPI sharpening) and only about 30 times a second. It covers the whole screen, and at full quality on a big monitor it was eating the frame budget.
- Glow effects (`shadowBlur`) are okay for brief one-off effects like unlock sparkles, but keep them out of anything that draws every single frame.

---

## Building colliders from artwork

> **Dormant as of the all-circle change.** No planet currently sets `outline: true`, so none of this runs: `loadOutlines()` is still called at boot but finds nothing, and the poly-decomp CDN script is loaded but unused. It's kept because the machinery is intact and an outline planet could be re-added. If you're trimming, this whole path (plus the poly-decomp `<script>` in play.html) is safe to delete.

Planets flagged `outline: true` need a collider traced from an SVG file. The file has to contain one or more `<path>` elements whose id starts with `silhouette` (Illustrator mangles the full ids, so we match on the start of the name).

Each silhouette path is split into its subpaths first (every `M`/`m` starts one), because Illustrator likes packing the real outline plus tiny decorative shapes into one path; sampling that as one polyline created phantom bridges that broke poly-decomp. Tiny subpaths (under 5% of the biggest one's bounding box) are dropped as artifacts; real secondary pieces like Saturn's rings survive. We then walk each kept subpath grabbing a point every 12px, and measure everything from the center of the SVG's viewBox (not the shape's own bounding box) so the collider and the picture share the same center.

If poly-decomp isn't loaded or the outline is broken, the collider builder returns nothing and we quietly fall back to a plain circle. Check the console for warnings if a planet's collider looks wrong.

The same un-decomposed outline sets feed the new-planet unlock glow (renderer.js traces a planet's true edges, rings included, when its kind is first created in a run).

---

## Dev panel (admins only, add `?dev=1`)

To open the game raw with the dev panel unlocked, skipping the normal site wrapper:

```
http://localhost:3000/games/planet-merge/play.html?dev=1
```

Start the site first with `npm run dev`. The dev panel does not exist on the live site (brzio.com). Only a signed-in admin running locally gets the `?dev=1` link, and typing it by hand in production just flips a CSS class with nothing behind it.

| Control | What it does |
|---|---|
| **Local Storage CLEAR** | Wipes perks, stats, and the saved game for testing (leaves saved scenarios alone) |
| **Scenarios** | Save the current board as a replayable test case (stored in `pm_dev_scenarios`); each card's ▶ loads that exact planet arrangement back in via the same restore path as Continue. For reproducing physics bugs and checking a fix holds. |
| **Auto-Drop** | Keeps dropping at a fixed spot for stress-testing |
| **Speed** | Runs physics 1x to 10x faster |
| **Drop X** | Where auto-drop drops, from left to right |
| **Drop** | Which planet drops: weighted (normal), random (any of the 12 equally), or a specific one |
| **Colliders** | Overlays the real physics shapes for debugging |
| **Choose / Destroy Power** | Force a power permanently armed (it re-arms after each use) for UI work |
| **Planet Physics** | Live sliders for mass power, impact kick, shake strength and falloff, plus a JSON editor and a fill-the-shake-meter button |
| **Solver Iter** | Live contact-solver iterations (position 6-20; velocity follows at ~0.6x). Shipping value 14/8. For finding the cheapest setting that still holds the anti-crush fix: lower it, replay a crush Scenario, watch for embedding |
| **Stats** | Drops, games, average score this session, and Phys: physics ms per frame (avg / max over ~2s; ~8 ms is the 60 Hz budget) |

---

## One endless mode that ramps up

There's no easy, normal, or hard. There is one endless mode that gets harder as your **score** climbs. A boolean called `playing` (state.js) tracks whether a round is active.

The **start screen** shows the ship-skin selector, a Play button (relabelled "New Game" when a save exists, alongside a Continue button), and a Game Statistic button opening the shared stats/perks overlay. The merge-order legend under the game hides on the start screen, and hides the Star icon until Stars actually drop (level 2).

The difficulty ladder is a table called `LEVELS` near the top of levels.js. Each row says: the score you need to reach it, which planets can drop, whether chains can still grant each power, and the text and artwork for its level-up popup. To stretch the ramp out, just add rows. Nothing else needs to change.

The levels as shipped:

- **Level 1** (score 0): drops Moon, Pluto, Mercury, Mars, Venus. No Stars yet.
- **Level 2** (score 3000): Stars start dropping.
- **Level 3** (score 7000): Venus stops dropping.
- **Level 4** (score 12000): the Eliminate power turns off.
- **Level 5** (score 15000): the "pick your next planet" power turns off.
- **Level 6** (score 20000): shakes stop raising the rainbow shield. See "The Shake meter" below. From here on a shake no longer protects you, so shaking can actually end the run.
- **Level 7** (score 250000): auto earthquake, the final level. The manual shake button is locked out (clicking it just says the shakes are automatic now), and instead each drop has a random chance to fire a shake burst on its own, 1 to 6 in a row. Most drops stay quiet, some erupt. With no rainbow shield, an unlucky burst can topple your stack.

Two level fields drive that: `rainbow` (defaults to true; set false to drop the shield, level 6) and `autoShake` (defaults to false; set true for the earthquake, level 7). Older rows just leave both off.

The level-up popup shows either a plain planet (level 2 shows Stars), a plain power icon (level 7's seismograph bars for the earthquake), or, for levels that take something away, that thing behind a red no-smoking-style ring and slash (level 3's Venus, level 4's Eliminate, level 5's Choose, level 6's rainbow). Level 1 has no popup, since it's where you start.

Whenever the score changes, the game checks if you've crossed into a new level. If so it updates which planets drop, takes away any power the new level bans, and slides a level-up banner in from the top for a couple of seconds. It never pauses the game, and if a single chain vaults you past two levels at once, you get both banners.

### The LEVEL cell and the current-level card

The hud bar has a LEVEL cell between Settings and SHAKES showing the current level number. Clicking it opens a card (same overlay pattern as perks and settings) that spells out the live `LEVELS` row as bullets: which planets drop right now (as icons), whether the Choose and Eliminate powers still work, whether the rainbow shield is up, and whether shakes are manual or automatic, each with a green check or a red cross. A callout at the bottom shows what changes at the next level and the score it takes to get there.

The whole thing lives in levels.js and re-renders from `curLevel()` every time it opens, so it can never drift from the ladder: edit a `LEVELS` row and the card follows. If a chain levels you up while the card is open, it re-renders in place. Dropping is blocked while the card is open (game.js checks `levelInfoOpen()` in `drop()`), the game itself keeps running.

### Scoring

- Each merge is worth the points of the planet you merged (defined in config.js). Points double per size: Stars are worth 1, Moon 2, on up to the Sun at 2048.
- A **chain** (several merges from one drop) multiplies the whole chain's points by how long it was. Five merges worth 10 points total become 10 x 5 = 50. The score climbs live as the chain plays out, and resets on the next drop.
- Note that the score counts **points**, not merges. Merges are counted separately, because some perks care about the raw number of merges.
- On screen the score is shortened past a thousand (12,400 shows as 12.4k, then m).

### Two Suns (still endless, no win screen)

When two Suns touch, they pop, you get a flat bonus (`VANISH_BONUS`, 4096), and the game keeps going. There's no victory screen. A run only ends by losing.

### How you lose (two ways, one warning line)

Both lose checks live in game.js, and the game-over overlay names the reason (`#loss-reason`).

1. **A planet falls out of the container** (`checkOver`). The side walls stop at `WALL_TOP`, so an overfull stack can push a planet over the rim. Escapes are tracked honestly: a planet only counts as escaping if it actually crossed the open rim while outside the walls (`rimEscapedIds`); anything else outside the x range is a tunneling glitch and gets pushed back in. An escapee that tips back inside the container is forgiven. The run ends only when the escaped planet has fallen past the bottom of the canvas. The shake shield (`isProtected`) suspends this check, and every planet gets a 1.6s grace after spawning (which also protects freshly-restored saves).
2. **The board is full** (`checkBoardFull`). Every sampled drop spot across the width is blocked for an Earth-sized planet, and it stays that way for `NO_ROOM_MS` (900ms, config.js). The dwell time is deliberate: a chain mid-cascade briefly crowds the board, and it must not end a run that has room again once things settle. The check only arms once older board planets reach the top fifth of the container, which is also when the red dashed warning line appears 50px below the ship. Freshly dropped falling planets are ignored for 1.6s, so the warning does not flash just because a new planet enters from the top. It runs on a 96ms sampling cadence and stands down during cooldowns, the choose countdown, the shield, or while an escape is in flight.

### The death replay

A "planet fell out" loss doesn't cut straight to the overlay. The game keeps a rolling 2.4s position history (sampled every 80ms, and only while something is near the top, so it costs nothing in calm play). On that loss it replays the culprit's last moments for ~2.9s: the camera zooms to ~2.65x on the planet, a cyan trail traces its path, a pulsing ring marks it, and a caption says which planet fell out. Then the game-over overlay appears. A board-full loss skips the replay.

---

## The Shake meter

There's a SHAKES bar in the HUD that fills as you merge: +1% per merge normally, +5% per merge once the current chain hits 3, +10% for the 5th merge, +5% after that. When it hits 100% it arms (the cell flips to a "TIME FOR / Shake" call to action), and clicking it does a "shake": every settled planet pops upward, higher the less weight is stacked on it. Each click costs 10% of the meter (`SHAKE_COST` in config.js), and clicking again within 0.7s makes the next one 1.3x stronger (capped at 3x).

One subtlety that used to be a bug: merges set off by the shake itself keep feeding the meter in odd increments, so it can land on a value below one click's cost. The last click always spends whatever remains, so the meter reaches exactly 0, disarms, and starts refilling. Never bring back a "must have at least SHAKE_COST" guard; that strands the meter at 3% armed and unclickable.

Normally a shake also throws up a rainbow arch across the top for 4 seconds and suspends the game-over check while it's active, so a shake can never cost you the run. The arch is not just paint: physics.js adds a real bouncy segmented ceiling along the same curve, so popped planets bounce back down instead of escaping. New drops are blocked while the shield is up. That safety net is what levels 6 and 7 take away:

- **Level 6** turns the rainbow off (`rainbow: false`). You can still shake, but there's no shield and no game-over pause, so a badly-timed shake can throw a planet over the wall and out, ending the run.
- **Level 7** turns on the auto earthquake (`autoShake: true`). The manual button stops working (it shows a brief notice instead), and drops randomly trigger shake bursts on their own. The auto-shake ignores the meter entirely, it's a hazard now, not something you spend.

---

## Perks (unlockable achievements)

A simple achievement system. Everything runs off the `PERKS` list near the top of perks.js, so adding one is just a new entry there plus a call to award it at the right moment.

- **Three tabs:** wins, merges, and losing. Each perk has an id, a tab, a title, a goal, and an icon, plus optional sound and level.
- **What's there now:** the wins tab has one for 200 merges in a single run. The merges tab has one for every planet you can create by merging (so everything except the Star, which is only ever dropped). Those merge perks unlock only when the planet is born from a merge, never from dropping one. The losing tab rewards finishing a run under 100 and under 150 merges.
- **Saved** in the browser under `pm_earned_perks`. Awarding a perk you already have does nothing. The dev panel's "Local Storage CLEAR" button wipes perks, the saved game, and stats for testing.
- **The UI** is a PERKS hud cell showing how many you've earned out of the total. Clicking it opens the shared overlay on the Perks tab, jumping to the sub-tab of your most recent unlock. The same overlay's other main tab is Game Statistic (stats.js).
- **Some perks have audio:** those show a play button on their tile that plays a short clip explaining them (one at a time; it stops when you close the panel or switch tabs).
- **The unlock animation:** a little toast pops up in the center, then flies into the perk card, which pulses. Merge perks first play a quick ~1 second clip showing the two source planets flying together and popping, then the merged planet rising, so you see how it was made. If several unlock at once, they queue up and play one by one.
- You can't drop a planet while the perks panel is open.

---

## Auto-save, resume, and parent controls

- **Auto-save is silent.** There is no save button. When the tab is hidden mid-round (close, app switch, screen lock), `saveGame()` snapshots the run (level, score, merge count, current/next planet, both power charges including the destroy expiry counter, and every body's position/angle/velocity) into localStorage `pm_saved_game` (a `v: 2` blob; older versions are silently dropped).
- **The start screen offers a one-time Continue.** Resuming consumes the save (no rewinding to the same point twice); leaving again writes a fresh one. Clicking New Game wipes it. Restored charges are re-checked against the current level's bans, and every restored body gets the normal spawn grace so resuming can never instantly lose.
- **Parent controls** (settings.js): an optional daily play-time limit, guarded by an optional 4-digit PIN. It only blocks STARTING a new round, never cuts a live one. `startGame()` checks `dailyLimitReached()` and shows a message on the start screen instead.
- Settings also hosts the How to Play copy (desktop and mobile variants) and the sound toggle (the mute flag itself lives in audio.js).
- A **fullscreen button** sits fixed bottom-right on desktop (hidden on mobile, where iframe fullscreen is unreliable). It fullscreens the documentElement; the site-side wrapper allows it via `allow="fullscreen"`.

---

## Restart

The restart button (handled in game.js):

- Removes every planet from the board
- Clears all the tracking data, queues, effects, and the death-replay state
- Resets the score, drop state, chain, autopilot, and any charges
- Hides the game-over screen
- Does **not** reload the page (reloading looks janky inside the iframe)

Clicking Play Again before a round was ever started just reopens the start screen instead of launching an unprimed round. A finished game also clears the auto-save, so Game Over can't be resumed around.

---

## Common mistakes when changing things

- **Adding a planet?** Just add it to `SHAPES`. Never hardcode a planet's position in the list. Use "the length of the list minus one" for the biggest planet, and read points and other values off the planet itself.
- **Adding a ship skin?** Drop the 10:7 SVG in assets/images and add it to `SHIP_SKINS` in game.js. The selector, persistence, and baking all key off that list.
- **Tuning how the physics feel?** Bounciness, friction, and air drag are set when a planet spawns, in physics.js. Gravity is set when the engine is created. Weight comes from tuning.js and is live-adjustable in the dev panel. Chain thresholds, cooldowns, and shake numbers live in `BALANCE` in config.js.
- **Adding a new power?** Copy how the existing two work: add a threshold to `BALANCE`, a state variable, a UI update, the grant branch in `registerChain`, and a line in `revokeBannedCharges` if levels can ban it.
- **Keep logic out of renderer.js.** The renderer only looks at state and draws it. Anything that changes state belongs in game.js or physics.js.
- **Always spawn and remove planets through the proper functions.** They keep the tracking data in sync. Adding or removing planets directly leaves ghosts behind.
- **Changing what a power or level does?** Update all three tellings of the story: the code, the level card / destroy overlay copy, and the blog post blocks in posts.json.
