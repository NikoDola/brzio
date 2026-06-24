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
    //   2 = flat density (the shipping behaviour: mass grows with AREA only).
    //   3 = volume / "3D" mass (density ∝ radius): big planets get dramatically
    //       heavier, small ones flick off them. This is the "density: 0.002 *
    //       (rad / r(0))" feel — reach it by setting Mass Power to 3.
    //   2.7 = current default: big planets noticeably outweigh and shove small
    //       ones (e.g. Uranus ~2.4x Venus) without going full volume-mass.
    massPower:      2.7,
    // Multiplies the impact kick in game.js. 1 = shipping. 0 = vanilla Matter.
    impactStrength: 1.0,
    // Per-planet density multiplier, indexed by level. 1 = unchanged.
    massMult:       SHAPES.map(() => 1),
    // SHAKES power-up: random jolt per planet on each shake-click. Higher =
    // bigger jolt. Heavier planets move less; shakeMassFalloff controls how much
    // (0 = mass ignored, 1 = impulse ∝ 1/mass). Live-tunable in the dev panel.
    shakeStrength:    6,
    shakeMassFalloff: 0.5,
};

// Anchor on the smallest planet so massPower never moves the Star's mass.
const R_REF = r(0);

/** Density Matter should use for a body at this level, given current TUNING. */
export function densityFor(lvl) {
    const rad  = r(lvl);
    const mult = TUNING.massMult[lvl] ?? 1;
    return BASE_DENSITY * Math.pow(rad / R_REF, TUNING.massPower - 2) * mult;
}
