/* ════════════════════════════════════════════════════════════════════════
   tuning.js  —  live-tunable physics knobs (dev panel)
   A single mutable object both physics.js (body density on spawn) and game.js
   (impact kick strength) read from. The dev "Planet Physics" editor mutates
   it. Defaults reproduce the shipping physics EXACTLY, so leaving every
   control alone changes nothing.
   ════════════════════════════════════════════════════════════════════════ */

import { SHAPES, r } from './config.js';

// Density of the reference planet (the smallest, Stars). Matter mass = density
// × area, so this is what every other planet's density is derived from.
export const BASE_DENSITY = 0.002;

export const TUNING = {
    // mass ∝ r^massPower.
    //   2 = flat density (mass grows with AREA only). This is the default now: a
    //       higher power made big planets so much heavier than small ones (e.g.
    //       Jupiter ~28x Mercury at 2.7) that Matter's solver couldn't push a
    //       heavy planet back off a light one, so small planets got crushed deep
    //       inside big ones and spun. Flat density keeps ratios sane (~12x) so
    //       contacts separate cleanly.
    //   3 = volume / "3D" mass (density ∝ radius): big planets get dramatically
    //       heavier, small ones flick off them — but reintroduces the crush bug.
    massPower:      2.0,
    // Hard ceiling on how many times heavier than the Star ANY planet can be.
    // Even at flat density, mass follows area, so Jupiter is ~90x a Star and
    // ~40x a Moon: enough weight that the solver cannot hold the contact open
    // and the small planet gets crushed inside (and spun by the churning
    // friction). Capping the ratio keeps big-vs-small contacts solvable.
    massRatioCap:   26,
    // Multiplies the impact kick in game.js. 1 = shipping. 0 = vanilla Matter.
    impactStrength: 1.0,
    // Per-planet density multiplier, indexed by level. 1 = unchanged.
    massMult:       SHAPES.map(() => 1),
    // SHAKES power-up ("Pop"): how hard settled planets jump. Higher = bigger
    // jump. shakeMassFalloff makes heavier planets move less (0 = mass ignored,
    // 1 = impulse ∝ 1/mass). Live-tunable in the dev panel.
    shakeStrength:    9.5,
    shakeMassFalloff: 0.1,
};

// Anchor on the smallest planet so massPower never moves the Star's mass.
const R_REF = r(0);

/** Density Matter should use for a body at this level, given current TUNING.
 *  The body's mass relative to the Star is (rad/R_REF)^massPower, clamped at
 *  massRatioCap; density is whatever makes the area produce that mass. */
export function densityFor(lvl) {
    const rad  = r(lvl);
    const mult = TUNING.massMult[lvl] ?? 1;
    const ratio  = Math.pow(rad / R_REF, TUNING.massPower);   // uncapped mass vs Star
    const capped = Math.min(ratio, TUNING.massRatioCap);
    return BASE_DENSITY * (capped / Math.pow(rad / R_REF, 2)) * mult;
}
