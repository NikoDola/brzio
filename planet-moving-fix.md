# Fix: small planets buried inside big ones (the crush bug, again)

## Context

Screenshot shows a Pluto sunk inside a Mercury and a Mars while a Uranus rests on top. This is the long-running "crush" bug. The user is fine with heavy planets pressing down; what must never happen is a small planet staying embedded instead of being squeezed out to its natural resting spot. The user explicitly invited a different physics approach.

## Root cause (found in `public/games/planet-merge/physics.js`)

The current per-step safety net `separatePenetrations` (physics.js:452) is what keeps the buried state stable, for two reasons:

1. **The allowance is huge.** `allowance = max(10, min(radius) * 0.2)` means Pluto (r=39) may legally sit 10px inside Mercury AND 10px inside Mars at the same time. Combined with pocket geometry and spawn-order drawing (big planets drawn over the small one), that alone reads as "Pluto is inside them".
2. **Beyond the allowance, the correction zeroes both bodies' full linear + angular velocity every step.** Under sustained load (Uranus pressing) this erases the separation impulses Matter's solver builds inside `Engine.update`, so the solver can never win. And the single-pass pairwise correction is non-convergent in a pocket: separating Pluto from Uranus (above) pushes Pluto deeper into the Mercury/Mars wedge, separating from Mercury pushes it into Mars, and vice versa. The system oscillates at a permanently buried equilibrium.

Renderer is not at fault: sprites draw at exactly the collider radius (`renderer.js:436`), so the visual overlap is real physics overlap.

## Fix: replace the safety net with an iterative positional relaxation

All planets are plain circles now, so exact analytic depenetration is cheap and robust. Rewrite `separatePenetrations` in [physics.js](public/games/planet-merge/physics.js) (call site stays `game.js:1625`, once per 8ms step) as a small Gauss-Seidel style relaxation:

- **Constants** (top of the function's section, commented):
  - `PEN_SLOP = 2` px: allowed resting overlap, invisible at planet scale (down from 10+).
  - `PEN_RELAX = 0.4`: fraction of the excess corrected per sweep.
  - `PEN_SWEEPS = 3`: sweeps over all pairs per physics step (multi-contact pockets converge because walls/floor and every neighbour push back within the same step).
- **Per pair, per sweep:** if `overlap > PEN_SLOP`, move the two bodies apart along the centre line by `(overlap - PEN_SLOP) * PEN_RELAX`, split by inverse mass (heavy Uranus barely moves, light Pluto does the moving). Clamp each moved body inside the walls/floor (reuse the existing clamp math in `depenetrate`).
- **Velocity handling (the key change):** do NOT zero velocities wholesale. `Body.setPosition` in Matter 0.19 preserves velocity by default. Instead, remove only the *approaching* component of the pair's relative velocity along the contact normal (inverse-mass weighted). Separating pairs are left untouched, so restitution bounces (already applied inside `Engine.update`) survive; only sustained squeezing is damped. This is what lets the solver + relaxation actually make progress instead of being frozen mid-burial.
- **Sleeping:** small corrections use `setPosition` without waking, so settled stacks get tidied silently with no jitter storm. Only wake (and zero angular velocity, per the old anti-spin rule) when the excess is deep, over ~20% of the smaller radius, i.e. a genuine burial that needs to re-settle.
- Keep the coincident-centres fallback (push straight up) and the wall clamps.

Cost: ~30 bodies max, so ~435 pairs x 3 sweeps per step. Trivial next to the existing per-step pair scan, and it may even allow lowering `positionIterations` later (not in scope).

**Untouched:** `separateOverlapping` (post-merge case), the spin limiter, `wakeAllShapes`, the impact kick, masses/densities in tuning.js. The user wants heavy planets to stay heavy; we change how overlap resolves, not the weights.

## Files to change

1. [public/games/planet-merge/physics.js](public/games/planet-merge/physics.js): rewrite `separatePenetrations` + `depenetrate` (lines ~435-489) as described; update the block comment to explain the new model and why velocity-zeroing was the trap.
2. [public/games/planet-merge/CLAUDE.md](public/games/planet-merge/CLAUDE.md): update the two "No planet may sit deeply inside another" entries in Physics oddities (the long one and the short duplicate) to describe the relaxation model and its constants.

No posts.json change: this is an internal physics glitch fix, not player-facing behaviour described in the blocks.

## Verification

1. `npm run dev`, open `http://localhost:3000/games/planet-merge/play.html?dev=1`.
2. **Reproduce the screenshot case:** dev panel Drop selector, drop Pluto + Mercury + Mars to form a wedge, then force-drop big planets on top (or merge up to Uranus). Confirm the small planet is squeezed out to rest tangent in the pocket instead of embedding. Colliders overlay ON to see true geometry.
3. **Replay saved crush Scenarios** from the dev panel if any exist in `pm_dev_scenarios`.
4. **Stress:** Auto-Drop + Speed 10x for a few minutes. Watch for: embedded planets (the bug), jitter in settled stacks (SLOP too tight), runaway spin (should stay dead), floating planets, and the Phys ms stat staying in budget (~8ms).
5. **Feel check:** normal drops still bounce (restitution intact), shakes still pop planets, merges still push neighbours out.

Tuning fallbacks if verification shows issues: raise `PEN_SLOP` to 3 if settled stacks jitter; raise `PEN_SWEEPS`/`PEN_RELAX` if deep stacks still ooze.
