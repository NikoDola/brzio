# Shape Merge

A Suika-style merge game built with vanilla JavaScript and Matter.js. Drop random shapes; two of the same kind merge into the next size up. Two of the largest shape vanish for a bonus. Stack too high and it's game over.

No build step, no bundler, no npm. Just static files served by any local HTTP server.

---

## How to run

ES modules require a real HTTP server — opening `index.html` via `file://` will break the imports.

**Easiest options:**
- VS Code "Live Server" extension → right-click `index.html` → *Open with Live Server*
- `npx serve .` from the project folder
- `python -m http.server 8000`

Then open `http://localhost:5500` (or whatever port your server uses).

---

## File structure

```
fruit-merge/
├── index.html        HTML scaffold: canvas, HUD, dev panel, game-over overlay
├── style.css         All styling
├── config.js         Shape definitions + layout constants (THE file to edit)
├── physics.js        Matter.js engine, walls, body lifecycle (spawn/despawn)
├── renderer.js       All canvas drawing (procedural shapes + assets + effects)
├── game.js           Main entry: game loop, state, input, merge/vanish logic
├── assets/           Optional shape_0.png … shape_9.png override the procedural look
└── README.md         You are here
```

Matter.js is loaded from CDN in `index.html` as a global, then destructured inside each module.

---

## File responsibilities

### `config.js` — the only file you need to edit for tuning
- `LAYOUT` — canvas size, walls, danger line, bonus value
- `SHAPES` — array of 10 shapes (smallest to largest), each with `name`, `size`, `sides`, `color`, `glow`, `pts`, `droppable`, `weight`
- `r(lvl)` — pixel radius for a given level
- `polyCorr(lvl)` — angle correction so visual rotation matches Matter.js's internal vertex offset
- `rndLvl()` — weighted-random level picker for drops

### `physics.js` — owns the world
- Creates the Matter.js engine and four walls
- Exports tracking maps: `bodyLvl`, `bodyBorn`, `active`
- `spawn(x, y, lvl, totalMs, angle)` — creates a body of the right type (circle / polygon / rectangle / proxy for plus/star) and registers it
- `despawn(body)` — removes from world and cleans tracking

### `renderer.js` — pure drawing
- `drawProcedural(c, lvl, cx, cy, angle)` — draws any shape with vertex paths, gradient fill, glow stroke, and level number on top
- `drawBody(ctx, body, bodyLvl)` — draws a live physics body (uses image asset if available, otherwise procedural)
- `drawNext(...)` — the NEXT preview thumbnail
- `drawFlashes(...)` / `drawPopups(...)` — visual FX that age and self-remove

### `game.js` — the orchestrator
- Wires the collision listener that queues pairs into `mergeQ` / `vanishQ`
- Runs the game loop with substep-based physics (stable at high sim speeds)
- Owns all input handlers (mouse, touch, keyboard, buttons)
- Owns the dev panel logic
- Handles restart

---

## Shape system

Each shape is defined by its `sides` field. The renderer and physics layer both branch on this value:

| `sides` value | Physics body              | Drawing path           |
|---------------|---------------------------|------------------------|
| `0`           | `Bodies.circle`           | `arc()`                |
| `3`–`12`      | `Bodies.polygon(n)`       | vertex loop            |
| `'plus'`      | `Bodies.polygon(4)` proxy | 12-point cross path    |
| `'star'`      | `Bodies.polygon(5)` proxy | 10-point star path     |
| `'rect'`      | `Bodies.rectangle`        | `rect()`               |

### Current 10 shapes
| Level | Name      | Sides | Droppable | Notes              |
|-------|-----------|-------|-----------|--------------------|
| 1     | Plus      | plus  | yes       | starter shape      |
| 2     | Star      | star  | yes       |                    |
| 3     | Rectangle | rect  | yes       |                    |
| 4     | Pentagon  | 5     | yes       |                    |
| 5     | Hexagon   | 6     | no        | merge-only         |
| 6     | Octagon   | 8     | no        |                    |
| 7     | Sphere    | 0     | no        |                    |
| 8     | Gold      | 10    | no        |                    |
| 9     | Crystal   | 12    | no        |                    |
| 10    | Sun       | 0     | no        | MAX — two vanish   |

### Adding a new shape (current process — clunky)
Adding a new custom shape currently requires touching **three files**:
1. `config.js` → add entry to `SHAPES`; add branch in `polyCorr` if it's a string-type sides value
2. `physics.js` → add branch in `spawn()` to build the right body
3. `renderer.js` → add branch in `drawProcedural()` to draw the path

This is one of the items flagged for refactor (see roadmap below).

---

## Game loop (how a frame works)

```
requestAnimationFrame(frame)
   │
   ▼
for s = 0 to simSpeed:                  (substeps — 1 at normal speed, up to 10 in dev mode)
    Engine.update(engine, 16ms)         physics advances
    tick cooldown / totalMs / canDrop
    flushMerges() / flushVanishes()     queued collision pairs become merges
    checkOver()                         stack-too-high detection
    if autoDropOn: drop()               dev-mode bot
   │
   ▼
draw background → walls → danger line → flashes → bodies → popups → drop guide
```

### Why substeps?
At high `simSpeed`, passing one giant `dt` to `Engine.update` causes Matter.js to miss collisions (shapes tunnel through each other). The fix: run N small 16ms physics steps per frame instead of one big step. Each substep is small enough that the physics stays stable, and merges fire correctly at every speed.

### Merge flow
1. Matter.js fires `collisionStart` event → handler queues pair into `mergeQ` (or `vanishQ` if max level)
2. `mergeSeen` Set tracks already-queued body IDs to prevent double-counting
3. After `Engine.update()` completes, `flushMerges()` removes both bodies, spawns the merged successor at the midpoint, awards points, triggers a flash + popup

---

## Dev mode

Click `⚙ DEV` (bottom-right of game) to expand the panel.

| Control       | What it does                                                           |
|---------------|------------------------------------------------------------------------|
| **Auto-Drop** | Toggles the bot — drops shapes automatically as fast as cooldown allows |
| **Speed**     | 1× to 10× simulation multiplier — physics, cooldowns, falling all scale |
| **Drop X**    | Where horizontally the bot drops (0% = left, 50% = center, 100% = right) |
| **Drops**     | Counter of drops in current game (resets on restart)                   |
| **Games**     | Total games played since page load                                     |
| **Avg score** | Running average across all finished games                              |

Useful for testing whether a "spam one spot" strategy wins, balancing weights/sizes, or stress-testing physics at 10× speed.

---

## Known issues

### Bug — Auto-Drop toggle throws ReferenceError
`game.js:329` references `autoDropTimer = 0` — a leftover from a previous design. The variable no longer exists. Clicking the Auto-Drop ON/OFF button will throw in the console. **One-line fix.**

---

## Refactor roadmap

Ordered by bang-for-buck. None of these are blocking — pick whatever appeals.

### Quick wins
- [ ] Fix the `autoDropTimer` ReferenceError above
- [ ] Move magic numbers (cooldown `560`, grace period `1600`, merge velocity `-3`, background colors, substep `16`) into a `TUNING` block in `config.js`
- [ ] Add `img.onerror` warnings to asset loading so missing files are obvious in the console
- [ ] Add JSDoc to all exported functions for editor autocomplete

### Architecture
- [ ] Centralize state into a `GameState` object so `restart()` becomes one line instead of resetting 10 variables individually
- [ ] Split `game.js` (currently 349 lines doing 6 jobs) into: `input.js`, `dev.js`, `merge.js`, leaving `game.js` as the boot + loop only
- [ ] Move wall/danger-line drawing out of `game.js` into `renderer.drawBackground()`

### Scalability (biggest wins for other developers)
- [ ] **Shape Strategy pattern** — one file per custom shape type, each exporting its physics-body factory + draw function + angle offset. Adding a new shape becomes one new file instead of three branches across three files.
- [ ] **Event bus** — replace direct DOM/state mutations in `flushMerges` with `events.emit('merge', {...})`. Score, FX, and any future sound/achievement systems subscribe independently.
- [ ] **Encapsulate physics state** — wrap `bodyLvl` / `bodyBorn` / `active` behind getter/setter functions so internals can change without breaking consumers.

### Developer experience
- [ ] Architecture diagram in this README (4 boxes: config → physics + renderer → game)
- [ ] "Adding a new shape" walkthrough (after the Strategy refactor lands)
#   p l a n e t - m e r g e  
 