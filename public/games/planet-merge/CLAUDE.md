# Planet Merge

A Suika-style merge game. You drop planets from the top, and two of the same kind touching each other merge into the next size up. Get two Suns to touch and they pop for a bonus. If your stack piles up past the red line near the top, the game ends.

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
| [physics.js](physics.js) | Everything Matter.js: the engine, the walls, tracking which body is which, building colliders from artwork, spawning and removing bodies. |
| [renderer.js](renderer.js) | All the drawing on the canvas: planets, effects, the "next planet" preview. It only reads game state and paints it. It never changes anything. |
| [game.js](game.js) | The brain. Game loop, input, merges, the chain counter, superpowers, restart, dev panel. This is the entry point. |
| [play.html](play.html) | The page skeleton: the canvas, the score and next panels, the dev panel, the game-over screen. Loads Matter.js and poly-decomp before starting the game. |
| [style.css](style.css) | All the styling. |

---

## How positions work

The game thinks in a fixed canvas that is **840 wide by 927 tall**, no matter what size the screen is. On smaller screens the canvas is just scaled down visually, but the game math always uses those fixed numbers. (They come from `LAYOUT.W` and `LAYOUT.H` in config.js.)

A few key spots on that canvas:

- The walls are 34px thick, so planets live between x=34 and x=806.
- The planet waiting to drop sits at the top, at y=81.
- The red dashed danger line is at y=133. If a planet settles above it and stays there for 1.6 seconds, the game ends.
- A Sun (the biggest planet) has a radius of 216px. Every other planet's size is a fraction of that.

---

## The planets

All 12 planets are defined in `SHAPES` in config.js, listed smallest to largest. Each one carries a few settings: whether it can be dropped from the top, how likely it is to be picked, whether its collider follows the artwork's outline, and which image file it uses.

One thing that trips people up: **the list of planets that can actually drop is not decided by that per-planet flag.** It's decided by the `drops` list on each level in game.js. The flag only feeds an old function that the game no longer calls. In the live game, level 1 drops Moon, Pluto, Mercury, Mars, and Venus. Level 2 adds Stars. From level 3 on, Venus stops dropping. Every other planet only ever shows up by merging.

To add a planet, just add it to `SHAPES`. The drop odds and the merge order sort themselves out.

---

## Chains and superpowers

Every time you drop a planet, any merges it sets off (including chain reactions) count up on a chain counter. That counter resets the moment you drop the next planet.

Hit enough merges in one drop and you earn a power:

- **3 merges in one drop** earns a "pick your next planet" charge. You'll see the arrows on the NEXT panel light up. Spend it on your next drop. This power gets switched off at level 5, where a 3-chain just shows you the number instead.
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

The difficulty ladder is a table called `LEVELS` near the top of game.js. Each row says: the score you need to reach it, which planets can drop, whether chains can still grant each power, and the text and artwork for its level-up popup. To stretch the ramp out, just add rows. Nothing else needs to change.

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

### Scoring

- Each merge is worth the points of the planet you merged (defined in config.js). Points double per size: Stars are worth 1, Moon 2, on up to the Sun at 2048.
- A **chain** (several merges from one drop) multiplies the whole chain's points by how long it was. Five merges worth 10 points total become 10 x 5 = 50. The score climbs live as the chain plays out, and resets on the next drop.
- Note that the score counts **points**, not merges. Merges are counted separately, because some perks care about the raw number of merges.

### Two Suns (still endless, no win screen)

When two Suns touch, they pop, you get a flat bonus, and the game keeps going. There's no victory screen. A run only ends when the stack tops the danger line, which brings up your score and a Play Again button.

### The Shake meter

There's a SHAKES bar in the HUD that fills as you merge (faster during a good chain). When it hits 100% it arms, and clicking it does a "shake": every settled planet pops upward, higher the less weight is stacked on it. It costs a slice of the meter per click, and clicking again quickly makes the next one a bit stronger.

Normally a shake also throws up a rainbow arch across the top and suspends the game-over check while it's active, so a shake can never cost you the run. That safety net is what levels 6 and 7 take away:

- **Level 6** turns the rainbow off (`rainbow: false`). You can still shake, but there's no shield and no game-over pause, so a badly-timed shake can push a planet over the line and end the run.
- **Level 7** turns on the auto earthquake (`autoShake: true`). The manual button stops working (it shows a brief notice instead), and drops randomly trigger shake bursts on their own. The auto-shake ignores the meter entirely, it's a hazard now, not something you spend.

---

## Perks (unlockable achievements)

A simple achievement system. Everything runs off the `PERKS` list near the top of game.js, so adding one is just a new entry there plus a call to award it at the right moment.

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
