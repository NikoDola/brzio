# Planet Merge

A Suika-style merge game. You drop planets from the top, and two of the same kind touching each other merge into the next size up. Get two Suns to touch and they pop for a bonus. The container is open at the top: overfill it and planets get pushed over the rim. A planet falling out of the container ends the game, and so does a board so crowded there's nowhere left to drop.

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
| [config.js](config.js) | Every planet's definition, layout numbers, and drop odds. **This is the file you edit to rebalance the game or add a planet.** |
| [tuning.js](tuning.js) | Live-tunable physics numbers (planet weight, impact kick, shake strength), shared by physics.js and the dev panel. |
| [physics.js](physics.js) | Everything Matter.js: the engine, the walls, tracking which body is which, building colliders from artwork, spawning and removing bodies. |
| [renderer.js](renderer.js) | All the drawing on the canvas: planets, faces, effects, the "next planet" preview. It only reads game state and paints it. It never changes anything. |
| [game.js](game.js) | The brain and the entry point. Game loop, input, merges, the chain counter, superpowers, restart. |
| [state.js](state.js) | The tiny shared `round` flags (playing, game over) every other module reads. |
| [levels.js](levels.js) | The `LEVELS` ladder: the drop roster per level, power bans, the level-up toast, and the LEVEL hud cell with its current-level card. |
| [shakes.js](shakes.js) | The SHAKES meter, the shake itself, the rainbow shield, and the auto earthquake. |
| [perks.js](perks.js) | The `PERKS` list, the perks overlay, unlock toasts and animations. |
| [stats.js](stats.js) | Lifetime stats (games, best score, play time, best chain) in localStorage. |
| [settings.js](settings.js) | The Settings overlay: sound toggle wiring, parent PIN, daily play-time limit. |
| [save-storage.js](save-storage.js) | Mid-run auto-save and the resume prompt. |
| [audio.js](audio.js) | All sound effects and the mute flag. |
| [background.js](background.js) | The full-page starfield behind the game. |
| [planet-icons.js](planet-icons.js) | Shared DOM planet icons (legend, perk tiles, level toasts and cards). |
| [dev-panel.js](dev-panel.js) | The `?dev=1` panel: auto-drop, sim speed, colliders, physics sliders, session stats. |
| [analytics.js](analytics.js) | Reports opens and game starts/ends to the parent site. |
| [play.html](play.html) | The page skeleton: the canvas, the hud bar, every overlay, the dev panel. Loads Matter.js and poly-decomp before starting the game. |
| [style.css](style.css) | All the styling. |

---

## How positions work

The game thinks in a fixed canvas that is **840 wide by 1288 tall**, no matter what size the screen is. On smaller screens the canvas is just scaled down visually, but the game math always uses those fixed numbers. (They come from `LAYOUT.W` and `LAYOUT.H` in config.js.)

A few key spots on that canvas:

- The walls are 34px thick, so planets live between x=34 and x=806.
- The planet waiting to drop sits at the top, at y=81.
- The side walls only start at y=133 (`WALL_TOP` in config.js); above that the container is open air. The physics floor spans just the inner width, so a planet pushed over a wall has nothing to land on and falls out of the world. There is no danger line anymore.
- A Sun (the biggest planet) has a radius of 216px. Every other planet's size is a fraction of that.

---

## The planets

All 12 planets are defined in `SHAPES` in config.js, listed smallest to largest. Each one carries a few settings: whether it can be dropped from the top, how likely it is to be picked, whether its collider follows the artwork's outline, and which image file it uses.

One thing that trips people up: **the list of planets that can actually drop is not decided by that per-planet flag.** It's decided by the `drops` list on each level in levels.js. The flag only feeds an old function that the game no longer calls. In the live game, level 1 drops Moon, Pluto, Mercury, Mars, and Venus. Level 2 adds Stars. From level 3 on, Venus stops dropping. Every other planet only ever shows up by merging.

To add a planet, just add it to `SHAPES`. The drop odds and the merge order sort themselves out.

---

## Chains and superpowers

Every time you drop a planet, any merges it sets off (including chain reactions) count up on a chain counter. That counter resets the moment you drop the next planet.

Hit enough merges in one drop and you earn a power:

- **3 merges in one drop** earns a "pick your next planet" charge. You'll see the choose arrows near the held planet light up. Spend it on your next drop. This power gets switched off at level 5, where a 3-chain just shows you the number instead.
- **5 merges in one drop** earns the **Eliminate** power: click any planet on the board and every planet of that type gets wiped out. You'll see pulsing red crosshairs over everything you can target. This power gets switched off from level 4 on.

If you're holding a charge and then cross into a level that bans that power, the charge is taken away right then. You can't smuggle a power into a level that forbids it.

Charges stick around across drops until you use them. There's no timer counting down. The only way to lose a chain in progress is to drop another planet.

(For the record: this used to be a timer-based combo system, with a 3-second window carrying across drops. That's gone on purpose. Chains are now a per-drop skill reward, so please don't bring the timer back.)

---

## Physics oddities (each one fixes a real bug, so read before removing)

Every item here looks weird until you know the bug it kills. The comment in the code explains each; here's the plain-English version.

**We wake up every planet after each merge, vanish, or destroy.**
Matter.js won't wake a planet just because the one holding it up disappeared. So a planet three layers up a stack would freeze in mid-air ("floating planets"). Nudging every sleeping planet awake after each merge fixes it, and with only ~30 planets on screen it costs nothing.

**Drops give the stack a real shove ("impact kick").**
In real physics, a tiny Star landing on a heavy Mercury barely moves it, which felt dead. So we add an extra push along the point of contact, scaled so heavy planets feel a proper shove while light Stars don't rocket off the screen. You can tune this live with the "Impact" slider in the dev panel (1 is normal, 0 turns it off).

**Planet weight is adjustable.**
How heavy each planet is comes from `densityFor()` in tuning.js, not a fixed number. There's a setting for how weight grows with size (the shipping default makes weight follow area), and a per-planet multiplier on top. The dev panel's mass slider re-weighs the planets already on screen instantly, so you feel changes right away. The defaults match the old behavior exactly.

**We give balancing planets a tiny sideways nudge.**
Two round planets stacked perfectly on top of each other should topple, but Matter.js's friction is happy to let them balance forever. So when we spot that perfectly-stacked situation, we nudge the top one sideways so it behaves naturally.

**Odd-shaped planets are made of several pieces.**
Planets that aren't simple circles (Moon, Saturn, Sun, anything using its artwork outline) get built out of multiple sub-shapes. Each piece reports its own collisions, so before figuring out which planet was hit, we always step up to the parent shape. Skip that and merges silently never happen for those planets.

**We ignore duplicate collision reports in the same instant.**
Because those multi-piece planets fire one collision per piece, the same real bump gets reported many times per frame. Without filtering the duplicates out, the impact kick stacks up and blows the pile apart.

**Some artwork needs an offset to line up with its collider.**
When we build a collider from an outline, Matter.js recenters it on its balance point, which usually isn't the center of the picture. So lopsided planets like Saturn would float above their actual collider. A small render offset pins the picture back onto the shape.

**Circles are actually 64-sided.**
Matter's default "circle" is a rough 14-to-26-sided polygon. Those flat edges make a planet that should bounce straight up slowly drift sideways instead. Bumping it to 64 sides hides the drift.

**Physics runs in fixed tiny steps.**
The game loop feeds real elapsed time into a bucket and drains it in fixed 8ms physics steps. Two reasons, both important. The tiny step stops a fast-falling Star from punching straight through a solid planet. And running on real time instead of frames means the game plays at the same speed on a 60Hz and a 144Hz monitor, and a laggy frame just costs a little sim time instead of snowballing.

Please don't switch back to "run physics N times per frame." That ties game speed to the monitor's refresh rate.

---

## Performance rules (these fixed real lag, please keep them)

- **Never draw an SVG image directly during gameplay.** Browsers redraw vector art from scratch almost every time, and this was the single biggest slowdown (it happened for every planet, every frame). Instead, renderer.js draws each planet's artwork once when the game loads, into an offscreen image, and copies that cheap copy every frame. One-off images that only appear once (the legend, perk icons, the start screen) can still use the SVG directly. That's fine.
- **No canvas filters during gameplay.** Filters force an extra hidden surface and a full pixel pass every draw. The planet shadow in the score area uses a pre-made black silhouette instead of a brightness filter.
- **The background starfield is deliberately cheap:** it renders at plain screen resolution (no high-DPI sharpening) and only about 30 times a second. It covers the whole screen, and at full quality on a big monitor it was eating the frame budget.
- Glow effects (`shadowBlur`) are okay for brief one-off effects like unlock sparkles, but keep them out of anything that draws every single frame.

---

## Building colliders from artwork

Planets flagged to use their outline need a collider traced from an SVG file. The file has to contain one or more `<path>` elements whose id starts with `silhouette` (Illustrator mangles the full ids, so we match on the start of the name).

We walk along the path grabbing a point every 12px, and measure everything from the center of the SVG's canvas (not the shape's own bounding box) so the collider and the picture share the same center.

If poly-decomp isn't loaded or the outline is broken, the collider builder returns nothing and we quietly fall back to a plain circle. Check the console for warnings if a planet's collider looks wrong.

---

## Dev panel (admins only, add `?dev=1`)

To open the game raw with the dev panel unlocked, skipping the normal site wrapper:

```
http://localhost:3000/games/planet-merge/play.html?dev=1
```

Start the site first with `npm run dev`. The dev panel does not exist on the live site (brzio.com). Only a signed-in admin running locally gets the `?dev=1` link, and typing it by hand in production just flips a CSS class with nothing behind it.

| Control | What it does |
|---|---|
| **Auto-Drop** | Keeps dropping at a fixed spot for stress-testing |
| **Speed** | Runs physics 1x to 10x faster |
| **Drop X** | Where auto-drop drops, from left to right |
| **Drop** | Which planet drops: weighted (normal), random (any of the 12 equally), or a specific one |
| **Colliders** | Overlays the real physics shapes for debugging |
| **Stats** | Drops, games, and average score this session |

---

## One endless mode that ramps up

There's no easy, normal, or hard. There is one endless mode that gets harder as your **score** climbs. A boolean called `playing` tracks whether a round is active, and the start screen shows a single **Play** button.

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

### Two Suns (still endless, no win screen)

When two Suns touch, they pop, you get a flat bonus, and the game keeps going. There's no victory screen. A run only ends by losing, which brings up your score and a Play Again button.

### How you lose (two ways, no danger line)

The old "settle above the red line" rule is gone. Both lose checks live in game.js:

1. **A planet falls out of the container** (`checkOver`). The side walls stop at `WALL_TOP`, so an overfull stack can push a planet over the rim; with the floor only spanning the inner width, it falls past the bottom of the canvas and the run ends. The shake shield (`isProtected`) suspends this check, and every planet gets a 1.6s grace after spawning.
2. **The board is full** (`checkBoardFull`). Every possible drop spot across the width is blocked, and it stays that way for `NO_ROOM_MS` (config.js). The dwell time is deliberate: a chain mid-cascade briefly crowds the board, and it must not end a run that has room again once things settle.

Related: when a board planet overlaps the current drop spot, the waiting planet dims to 0.7 opacity, wears its hurt face, and a red cross covers it (`drawPreview` in renderer.js, flag computed by `dropBlockedAt` in game.js). Clicking there is refused, and a refused drop must NOT reset the chain counter.

### The Shake meter

There's a SHAKES bar in the HUD that fills as you merge (faster during a good chain). When it hits 100% it arms, and clicking it does a "shake": every settled planet pops upward, higher the less weight is stacked on it. Each click costs 10% of the meter (`SHAKE_COST` in config.js), and clicking again quickly makes the next one a bit stronger.

One subtlety that used to be a bug: merges set off by the shake itself keep feeding the meter in odd increments, so it can land on a value below one click's cost. The last click always spends whatever remains, so the meter reaches exactly 0, disarms, and starts refilling. Never bring back a "must have at least SHAKE_COST" guard; that strands the meter at 3% armed and unclickable.

Normally a shake also throws up a rainbow arch across the top and suspends the game-over check while it's active, so a shake can never cost you the run. That safety net is what levels 6 and 7 take away:

- **Level 6** turns the rainbow off (`rainbow: false`). You can still shake, but there's no shield and no game-over pause, so a badly-timed shake can throw a planet over the wall and out, ending the run.
- **Level 7** turns on the auto earthquake (`autoShake: true`). The manual button stops working (it shows a brief notice instead), and drops randomly trigger shake bursts on their own. The auto-shake ignores the meter entirely, it's a hazard now, not something you spend.

---

## Perks (unlockable achievements)

A simple achievement system. Everything runs off the `PERKS` list near the top of perks.js, so adding one is just a new entry there plus a call to award it at the right moment.

- **Three tabs:** wins, merges, and losing. Each perk has an id, a tab, a title, a goal, and an icon, plus optional sound and level.
- **What's there now:** the wins tab has one for 200 merges in a single run. The merges tab has one for every planet you can create by merging (so everything except the Star, which is only ever dropped). Those merge perks unlock only when the planet is born from a merge, never from dropping one. The losing tab rewards finishing a run under 100 and under 150 merges.
- **Saved** in the browser under `pm_earned_perks`. Awarding a perk you already have does nothing. The dev panel's "Local Storage CLEAR" button wipes perks, the saved game, and stats for testing.
- **The UI** is a card under the merges panel showing how many you've earned out of the total. Clicking it opens a full tabbed grid, jumping to the tab of your most recent unlock. (It's deliberately not a bag or inventory icon.)
- **Some perks have audio:** those show a play button on their tile that plays a short clip explaining them (one at a time; it stops when you close the panel or switch tabs).
- **The unlock animation:** a little toast pops up in the center, then flies into the perk card, which pulses. Merge perks first play a quick ~1 second clip showing the two source planets flying together and popping, then the merged planet rising, so you see how it was made. If several unlock at once, they queue up and play one by one.
- You can't drop a planet while the perks panel is open.

---

## Restart

The restart button (handled in game.js):

- Removes every planet from the board
- Clears all the tracking data, queues, and effects
- Resets the score, drop state, chain, and any charges
- Hides the game-over screen
- Does **not** reload the page (reloading looks janky inside the iframe)

---

## Common mistakes when changing things

- **Adding a planet?** Just add it to `SHAPES`. Never hardcode a planet's position in the list. Use "the length of the list minus one" for the biggest planet, and read points and other values off the planet itself.
- **Tuning how the physics feel?** Bounciness, friction, and air drag are set when a planet spawns, in physics.js. Gravity is set when the engine is created. Weight comes from tuning.js and is live-adjustable in the dev panel.
- **Adding a new power?** Copy how the existing two work: add a threshold, a state variable, a UI update, and the branch that grants it.
- **Keep logic out of renderer.js.** The renderer only looks at state and draws it. Anything that changes state belongs in game.js or physics.js.
- **Always spawn and remove planets through the proper functions.** They keep the tracking data in sync. Adding or removing planets directly leaves ghosts behind.
